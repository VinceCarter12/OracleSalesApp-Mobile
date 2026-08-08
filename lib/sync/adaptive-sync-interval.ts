// Phase 1 adaptive sync scheduling (2026-08-04, Vince direction — see
// projects/OracleSalesApp-Mobile/Sync-Scale-and-Realtime-Options-2026-08-04.md).
// Pure interval/backoff/jitter math, split out so it's directly unit-testable
// without React/AppState/NetInfo. Consumed by adaptive-foreground-scheduler.ts.
//
// Important Phase 1 limitation (documented here, not just in the design
// note): "changed" is only ever known from local outbox push activity
// (`SyncResult.synced`/`.failed` in sync-engine.ts) — there is no per-entity
// cursor yet (Phase 2), so a purely remote-only change (e.g. a Manager
// approval with zero local outbox activity on this device) can NOT be
// detected as "changed" here. That's exactly why `MAX_IDLE_INTERVAL_MS` is
// capped at 2 minutes rather than growing to the 5-minute ceiling the
// architecture note floats for Option A — remote-only changes still rely on
// hitting the next poll, not on a real change signal, until Phase 2 lands.

/** Idle polling starts somewhere in this range — not a single fixed value, so devices don't all converge on the same cadence. */
export const BASELINE_MIN_MS = 30_000;
export const BASELINE_MAX_MS = 60_000;

/** Backoff ceiling — see the Phase 1 limitation note above for why this is conservative. */
export const MAX_IDLE_INTERVAL_MS = 120_000;

/** Doubles the interval on each consecutive zero-change idle tick, capped at MAX_IDLE_INTERVAL_MS. */
export const BACKOFF_MULTIPLIER = 2;

/** Symmetric +/- jitter applied on top of every scheduled delay. */
export const JITTER_MS = 5_000;

/** Never schedule shorter than this, even after jitter subtracts from a small interval. */
const MIN_SCHEDULED_DELAY_MS = 1_000;

/** Picks a random baseline within [BASELINE_MIN_MS, BASELINE_MAX_MS) — call once per scheduler instance, not per tick. */
export function pickBaselineIntervalMs(random: () => number = Math.random): number {
  return Math.round(BASELINE_MIN_MS + random() * (BASELINE_MAX_MS - BASELINE_MIN_MS));
}

/**
 * Given the outcome of the idle tick that just ran, returns the interval to
 * use for the NEXT idle tick. A changed pass always resets to baseline
 * (regardless of how far backoff had grown); an unchanged pass doubles the
 * current interval, capped at `MAX_IDLE_INTERVAL_MS`.
 */
export function nextIdleIntervalMs(currentIntervalMs: number, hadChanges: boolean, baselineMs: number): number {
  if (hadChanges) return baselineMs;
  return Math.min(Math.round(currentIntervalMs * BACKOFF_MULTIPLIER), MAX_IDLE_INTERVAL_MS);
}

/** Applies symmetric jitter to a scheduled delay so many devices with the same interval don't fire in lockstep. */
export function applyJitterMs(
  intervalMs: number,
  random: () => number = Math.random,
  jitterMs: number = JITTER_MS
): number {
  const offset = Math.round((random() * 2 - 1) * jitterMs);
  return Math.max(MIN_SCHEDULED_DELAY_MS, intervalMs + offset);
}
