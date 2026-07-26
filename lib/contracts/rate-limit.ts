// Batch 1 (ADR-036) scaffolding. This type is deliberately NOT coupled to
// `FailureClass` this batch: 429 responses currently classify as `'server'`
// via the existing pattern in `lib/sync/outbox-status.ts`. Adding a
// `'rate_limited'` member to `FailureClass` requires a paired SQLite
// migration (a full table rebuild, since SQLite can't ALTER a CHECK
// constraint) landing in the SAME change as the union widening — see
// ADR-036 in the vault's Decisions.md. Do NOT add an `isRateLimitError()`
// helper this batch.

export interface RateLimitResponse {
  retryAfterMs: number | null;
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
}
