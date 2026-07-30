import type { SessionSnapshot } from './session-snapshot';

// Split out of cold-start-bootstrap.ts so this pure decision logic can be
// unit-tested directly (vitest's node environment cannot import
// cold-start-bootstrap.ts itself — it transitively pulls in react-native via
// lib/supabase.ts, which vitest/rolldown cannot parse; see
// lib/app-lock/bootstrap-decision.test.ts). This file imports nothing but
// the `SessionSnapshot` type, so it stays safely importable anywhere.

export type BootstrapDecision =
  | { kind: 'rehydrate'; snapshot: SessionSnapshot }
  | { kind: 'signed_out'; shouldClearSnapshot: boolean };

/**
 * Pure decision logic for cold-start bootstrap (Batch 5 Slice 1, ADR-051),
 * kept separate from the I/O (getSession/readSnapshot/clearSnapshot calls).
 *
 * - No session user id → signed_out, nothing to clear (there may be no
 *   snapshot at all, or it may still be valid for a later online sign-in).
 * - No usable snapshot → signed_out, nothing to clear.
 * - `snapshot.userId !== sessionUserId` → signed_out AND clear the snapshot
 *   (cross-account leak guard — a stale snapshot from a previous account
 *   must never rehydrate the wrong role group).
 * - Otherwise → rehydrate with the validated snapshot.
 */
export function decideBootstrapOutcome(
  sessionUserId: string | null,
  snapshot: SessionSnapshot | null
): BootstrapDecision {
  if (!sessionUserId || !snapshot) {
    return { kind: 'signed_out', shouldClearSnapshot: false };
  }
  if (snapshot.userId !== sessionUserId) {
    return { kind: 'signed_out', shouldClearSnapshot: true };
  }
  return { kind: 'rehydrate', snapshot };
}
