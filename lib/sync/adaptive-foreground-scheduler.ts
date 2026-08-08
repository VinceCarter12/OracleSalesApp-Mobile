import { createCoalescingRunner } from './coalescing-runner';
import { applyJitterMs, nextIdleIntervalMs, pickBaselineIntervalMs } from './adaptive-sync-interval';

// Phase 1 adaptive sync scheduling (2026-08-04, Vince direction — see
// projects/OracleSalesApp-Mobile/Sync-Scale-and-Realtime-Options-2026-08-04.md).
//
// Replaces use-sync.ts's old fixed-10s `setInterval` drain timer. Pure/
// dependency-free by design (no React, no AppState, no NetInfo) — the hook
// (use-sync.ts) owns translating AppState/NetInfo events into calls on this
// scheduler's `start()`/`stop()`/`triggerImmediate()`, so this class is
// directly unit-testable with injected fake timers. See
// adaptive-foreground-scheduler.test.ts.
//
// Runs its own `createCoalescingRunner` around `runPass` (in addition to
// sync-engine.ts's own coalescing around `runSync()`) so that "multiple
// triggers during a running sync produce only one follow-up" holds at THIS
// layer too, independently testable without needing sync-engine.ts's
// native-module-dependent internals (getDb/supabase) mocked.

export type TimerHandle = ReturnType<typeof setTimeout>;

export interface AdaptiveForegroundSchedulerDeps {
  /** Runs one sync pass; return `{ changed: true }` if anything was pushed/failed, driving backoff/reset. */
  runPass: () => Promise<{ changed: boolean } | null>;
  setTimer?: (callback: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  random?: () => number;
}

export interface AdaptiveForegroundScheduler {
  /** Arms idle polling at the baseline interval. Does not itself run a pass — call `triggerImmediate()` first if one is wanted. */
  start(): void;
  /** Disarms idle polling and clears any pending timer — call on app background. */
  stop(): void;
  /**
   * Runs a pass right now (login/foreground/reconnect/manual — always resets
   * cadence to baseline, regardless of that pass's own changed/unchanged
   * result, since an explicit trigger means "something specific just
   * happened" rather than being part of the idle-poll cadence itself).
   */
  triggerImmediate(): Promise<void>;
  /** True while idle polling is armed (a timer is scheduled or about to be). */
  readonly isRunning: boolean;
}

export function createAdaptiveForegroundScheduler(deps: AdaptiveForegroundSchedulerDeps): AdaptiveForegroundScheduler {
  const setTimer = deps.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle));
  const random = deps.random ?? Math.random;

  const baselineMs = pickBaselineIntervalMs(random);
  const runner = createCoalescingRunner<void, { changed: boolean } | null>(() => deps.runPass());

  let currentIntervalMs = baselineMs;
  let timerHandle: TimerHandle | null = null;
  let armed = false;

  function clearArmedTimer(): void {
    if (timerHandle !== null) {
      clearTimer(timerHandle);
      timerHandle = null;
    }
  }

  function scheduleNextTick(): void {
    clearArmedTimer();
    if (!armed) return;
    const delay = applyJitterMs(currentIntervalMs, random);
    timerHandle = setTimer(() => {
      void tick();
    }, delay);
  }

  async function tick(): Promise<void> {
    if (!armed) return; // stopped while waiting for the timer to fire
    const result = await runner.run(undefined);
    if (!armed) return; // stopped mid-pass
    currentIntervalMs = nextIdleIntervalMs(currentIntervalMs, Boolean(result?.changed), baselineMs);
    scheduleNextTick();
  }

  return {
    start(): void {
      if (armed) return;
      armed = true;
      currentIntervalMs = baselineMs;
      scheduleNextTick();
    },
    stop(): void {
      armed = false;
      clearArmedTimer();
    },
    async triggerImmediate(): Promise<void> {
      currentIntervalMs = baselineMs;
      await runner.run(undefined);
      if (armed) scheduleNextTick();
    },
    get isRunning(): boolean {
      return armed;
    },
  };
}
