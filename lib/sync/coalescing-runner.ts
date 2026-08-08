// Phase 1 adaptive sync scheduling (2026-08-04, Vince direction — see
// projects/OracleSalesApp-Mobile/Sync-Scale-and-Realtime-Options-2026-08-04.md).
//
// Replaces the old boolean "drop overlapping sync" guard (sync-engine.ts's
// former `isSyncing` flag): a trigger that arrived while a pass was already
// running used to just return `null` and be silently discarded — losing the
// caller's intent entirely (e.g. a reconnect event or a write-service's
// fire-and-forget post-write sync). This runner instead lets AT MOST one
// follow-up pass queue behind the in-flight one: every trigger that arrives
// mid-pass sets `rerunRequested`, and the pass loops once more (using the
// most recently supplied args) before settling — never more than one
// coalesced extra pass, and never two passes running in parallel.
//
// Pure/dependency-free by design (no React, no native modules) so it's
// directly unit-testable — see coalescing-runner.test.ts.

export interface CoalescingRunner<TArgs, TResult> {
  /** Runs `execute` with `args`, or joins/coalesces into an already-running pass. */
  run(args: TArgs): Promise<TResult | null>;
  /** True while a pass (including any coalesced follow-up) is in flight. */
  readonly isRunning: boolean;
}

export function createCoalescingRunner<TArgs, TResult>(
  execute: (args: TArgs) => Promise<TResult>
): CoalescingRunner<TArgs, TResult> {
  let inFlight: Promise<TResult | null> | null = null;
  let rerunRequested = false;
  let latestArgs: TArgs | undefined;

  async function loop(): Promise<TResult | null> {
    let result: TResult | null = null;
    try {
      do {
        rerunRequested = false;
        // Non-null assertion is safe: `loop()` is only ever invoked from
        // `run()` immediately after `latestArgs` is assigned below.
        result = await execute(latestArgs as TArgs);
      } while (rerunRequested);
    } finally {
      inFlight = null;
    }
    return result;
  }

  return {
    run(args: TArgs): Promise<TResult | null> {
      latestArgs = args;
      if (inFlight) {
        rerunRequested = true;
        return inFlight;
      }
      inFlight = loop();
      return inFlight;
    },
    get isRunning(): boolean {
      return inFlight !== null;
    },
  };
}
