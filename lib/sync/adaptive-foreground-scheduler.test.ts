import { describe, expect, it, vi } from 'vitest';
import { createAdaptiveForegroundScheduler, type TimerHandle } from './adaptive-foreground-scheduler';

/** A fake timer the test drives manually — no real time ever passes. */
function createFakeTimer() {
  let nextHandle = 1;
  const scheduled = new Map<number, () => void>();
  const setTimer = vi.fn((callback: () => void, _ms: number): TimerHandle => {
    const handle = nextHandle++;
    scheduled.set(handle, callback);
    return handle as unknown as TimerHandle;
  });
  const clearTimer = vi.fn((handle: TimerHandle) => {
    scheduled.delete(handle as unknown as number);
  });
  /** Fires the most recently scheduled callback, as if its delay elapsed. */
  async function fireLatest(): Promise<void> {
    const handles = Array.from(scheduled.keys());
    const latest = handles[handles.length - 1];
    const callback = scheduled.get(latest);
    scheduled.delete(latest);
    callback?.();
    // Let the scheduler's internal async tick() run to completion — several
    // await layers deep (tick -> coalescing runner -> runPass), so flush
    // generously rather than guessing an exact microtask-tick count.
    await flushMicrotasks();
  }
  return { setTimer, clearTimer, fireLatest, scheduledCount: () => scheduled.size };
}

/** Drains pending microtasks without relying on a guessed exact tick count. */
async function flushMicrotasks(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('createAdaptiveForegroundScheduler', () => {
  it('arms the idle timer at a delay that is not the old fixed 10 seconds', () => {
    const timer = createFakeTimer();
    const scheduler = createAdaptiveForegroundScheduler({
      runPass: async () => ({ changed: false }),
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
      random: () => 0.5,
    });

    scheduler.start();

    expect(timer.setTimer).toHaveBeenCalledTimes(1);
    const delayMs = timer.setTimer.mock.calls[0][1];
    expect(delayMs).not.toBe(10_000);
    expect(delayMs).toBeGreaterThanOrEqual(25_000);
    expect(delayMs).toBeLessThanOrEqual(65_000);
  });

  it('stop() clears the armed timer', () => {
    const timer = createFakeTimer();
    const scheduler = createAdaptiveForegroundScheduler({
      runPass: async () => ({ changed: false }),
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
    });

    scheduler.start();
    expect(timer.scheduledCount()).toBe(1);

    scheduler.stop();
    expect(timer.clearTimer).toHaveBeenCalledTimes(1);
    expect(timer.scheduledCount()).toBe(0);
  });

  it('triggerImmediate() runs exactly one pass', async () => {
    const runPass = vi.fn(async () => ({ changed: true }));
    const timer = createFakeTimer();
    const scheduler = createAdaptiveForegroundScheduler({ runPass, setTimer: timer.setTimer, clearTimer: timer.clearTimer });

    await scheduler.triggerImmediate();

    expect(runPass).toHaveBeenCalledTimes(1);
  });

  it('coalesces multiple triggers that arrive during a running pass into one follow-up', async () => {
    const first = deferred<{ changed: boolean }>();
    const second = deferred<{ changed: boolean }>();
    let callCount = 0;
    const runPass = vi.fn(async () => {
      callCount += 1;
      return callCount === 1 ? first.promise : second.promise;
    });
    const timer = createFakeTimer();
    const scheduler = createAdaptiveForegroundScheduler({ runPass, setTimer: timer.setTimer, clearTimer: timer.clearTimer });

    const p1 = scheduler.triggerImmediate();
    const p2 = scheduler.triggerImmediate();
    const p3 = scheduler.triggerImmediate();

    expect(runPass).toHaveBeenCalledTimes(1); // no parallel pass started

    first.resolve({ changed: false });
    await vi.waitFor(() => expect(runPass).toHaveBeenCalledTimes(2)); // exactly one coalesced follow-up

    second.resolve({ changed: false });
    await Promise.all([p1, p2, p3]);
    expect(runPass).toHaveBeenCalledTimes(2); // still just two, never more
  });

  it('backs off (grows the interval) on repeated zero-change idle ticks', async () => {
    const timer = createFakeTimer();
    const scheduler = createAdaptiveForegroundScheduler({
      runPass: async () => ({ changed: false }),
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
      random: () => 0.5,
    });

    scheduler.start();
    const firstDelay = timer.setTimer.mock.calls[0][1];

    await timer.fireLatest(); // 1st idle tick — zero change
    const secondDelay = timer.setTimer.mock.calls[1][1];
    expect(secondDelay).toBeGreaterThan(firstDelay);

    await timer.fireLatest(); // 2nd idle tick — zero change again
    const thirdDelay = timer.setTimer.mock.calls[2][1];
    expect(thirdDelay).toBeGreaterThan(secondDelay);
  });

  it('resets to the baseline cadence the moment an idle tick reports a change', async () => {
    let changed = false;
    const timer = createFakeTimer();
    const scheduler = createAdaptiveForegroundScheduler({
      runPass: async () => ({ changed }),
      setTimer: timer.setTimer,
      clearTimer: timer.clearTimer,
      random: () => 0.5,
    });

    scheduler.start();
    const baselineDelay = timer.setTimer.mock.calls[0][1];

    await timer.fireLatest(); // zero-change — grows
    const grownDelay = timer.setTimer.mock.calls[1][1];
    expect(grownDelay).toBeGreaterThan(baselineDelay);

    changed = true;
    await timer.fireLatest(); // this tick has a change — resets
    const resetDelay = timer.setTimer.mock.calls[2][1];
    expect(resetDelay).toBe(baselineDelay);
  });

  it('never runs two passes in parallel across a burst of immediate triggers', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const runPass = vi.fn(async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await Promise.resolve();
      concurrent -= 1;
      return { changed: false };
    });
    const timer = createFakeTimer();
    const scheduler = createAdaptiveForegroundScheduler({ runPass, setTimer: timer.setTimer, clearTimer: timer.clearTimer });

    scheduler.start();
    await Promise.all([scheduler.triggerImmediate(), scheduler.triggerImmediate(), scheduler.triggerImmediate()]);

    expect(maxConcurrent).toBe(1);
  });
});
