import { describe, expect, it, vi } from 'vitest';
import { createCoalescingRunner } from './coalescing-runner';

/** Resolves/rejects on demand — lets a test hold a pass open mid-flight. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('createCoalescingRunner', () => {
  it('runs execute once for a single call and returns its result', async () => {
    const execute = vi.fn(async (n: number) => n * 2);
    const runner = createCoalescingRunner(execute);

    const result = await runner.run(21);

    expect(result).toBe(42);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('coalesces every trigger that arrives mid-pass into exactly one follow-up pass', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const calls: number[] = [];
    const execute = vi.fn((n: number) => {
      calls.push(n);
      return calls.length === 1 ? first.promise : second.promise;
    });
    const runner = createCoalescingRunner(execute);

    const p1 = runner.run(1);
    // Five more triggers arrive while the first pass is still in flight.
    const p2 = runner.run(2);
    const p3 = runner.run(3);
    const p4 = runner.run(4);
    const p5 = runner.run(5);
    const p6 = runner.run(6);

    expect(runner.isRunning).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1); // no parallel pass started yet

    first.resolve(100);
    // Let the coalesced follow-up pass start.
    await Promise.resolve();
    await Promise.resolve();
    expect(execute).toHaveBeenCalledTimes(2); // exactly one follow-up, not five
    expect(calls[1]).toBe(6); // follow-up uses the MOST RECENT args, not the first stale ones

    second.resolve(200);
    const results = await Promise.all([p1, p2, p3, p4, p5, p6]);
    // Every caller from the same coalesced window resolves to the same
    // (second, coalesced) pass's result — none of them silently got `null`.
    for (const r of results) expect(r).toBe(200);
    expect(runner.isRunning).toBe(false);
  });

  it('starts a fresh pass after a previous one has fully settled', async () => {
    const execute = vi.fn(async () => 'done');
    const runner = createCoalescingRunner(execute);

    await runner.run(undefined);
    await runner.run(undefined);

    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('never runs two passes in parallel even under a burst of triggers', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const execute = vi.fn(async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 0));
      concurrent -= 1;
      return null;
    });
    const runner = createCoalescingRunner(execute);

    await Promise.all([runner.run(undefined), runner.run(undefined), runner.run(undefined), runner.run(undefined)]);

    expect(maxConcurrent).toBe(1);
  });
});
