// 2026-08-16 (Vince direct on-device feedback): the Manager Home "new
// requests" popup's watermark used to persist in `expo-secure-store`
// forever, so a request that popped once never triggered the popup again
// even if it was still `pending` (never approved/declined). Vince confirmed
// the intended cadence is "once per cold start / once per sign-in, but a
// still-pending item keeps popping up across sessions" — not "once ever".
//
// Deliberately in-memory-only (module-level `Set`), not persisted anywhere:
// this was always an ephemeral UI nudge, never durable business data.
// A fresh app process (cold start) gets a fresh empty module for free,
// satisfying "once per cold start" without extra reset logic. The
// once-per-sign-in case (app process NOT restarted, but the signed-in
// profile changes) is handled by `resetPoppedRequestIds()`, called from
// `lib/use-manager-request-popup.ts` whenever `profileId` changes to a new
// non-null value.
let poppedRequestIds = new Set<string>();

/** Request ids that have already triggered the Manager Home popup this session. */
export function getPoppedRequestIds(): Set<string> {
  return new Set(poppedRequestIds);
}

/** Marks the given request ids as "already popped up this session". Safe to call with an empty array. */
export function markRequestsPopped(ids: string[]): void {
  if (ids.length === 0) return;
  for (const id of ids) poppedRequestIds.add(id);
}

/** Clears the session watermark — call on a fresh sign-in so a new session re-evaluates from a clean slate. */
export function resetPoppedRequestIds(): void {
  poppedRequestIds = new Set();
}
