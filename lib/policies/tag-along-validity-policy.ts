import type { MeetingValidityStatus } from '../../types';
import type { RemoteTagAlongInviteeKind } from '../../types/database';

// ADR-046 (correction addendum, 2026-07-28): pure decision logic for the
// meeting `validity_status` gate. Only a pending MANAGER-kind tag-along
// (`invitee_kind='manager' AND context='meeting' AND status='pending'`)
// ever blocks lifecycle validity/quota eligibility — a pending TEAMMATE
// tag-along never does. Kept side-effect-free (no DB/SQLite here) so it's
// testable under the repo's node-only vitest config (see vitest.config.ts's
// "pure function tests only" comment) — the DB-touching callers live in
// lib/meeting-service.ts (creation) and lib/tag-along-validity-service.ts
// (sync-down reconciliation).

/**
 * Decides a NEW meeting's initial `validity_status` at creation time
 * (lib/meeting-service.ts::createMeeting). `companionsPreAccepted` mirrors
 * F-205 decision 2: a Manager recording their own meeting always inserts
 * companions pre-accepted (never a real pending gate against themselves),
 * so that path is always 'valid' regardless of which kinds were selected.
 * Otherwise, only a selected MANAGER companion creates the pending gate — a
 * teammate-only (or empty) selection is 'valid' immediately.
 */
export function computeMeetingValidityStatusOnCreate(
  companions: readonly { kind: RemoteTagAlongInviteeKind }[],
  /** @deprecated retained only for compatibility with historical pure-policy tests; Manager recording no longer supplies this flag. */
  companionsPreAccepted = false
): MeetingValidityStatus {
  if (companionsPreAccepted) return 'valid';
  const hasPendingManagerCompanion = companions.some((companion) => companion.kind === 'manager');
  return hasPendingManagerCompanion ? 'pending_confirmation' : 'valid';
}

/**
 * Decides whether a meeting's pending gate can clear, given the current
 * pending/declined counts across ALL manager-kind tag-alongs attached to it
 * (a meeting can have up to `MAX_COMPANIONS_PER_REQUEST` companions, so more
 * than one manager-kind row is theoretically possible). Clears to 'valid'
 * only when every manager gate is accepted (zero pending, zero declined). A
 * single declined manager tag-along keeps the meeting excluded PERMANENTLY —
 * per Vince's explicit correction, this is not a new terminal state, the
 * meeting simply never leaves 'pending_confirmation' via this gate; the
 * meeting record itself is never deleted/discarded by this decision.
 */
export function shouldMeetingBecomeValid(pendingManagerCount: number, declinedManagerCount: number): boolean {
  return pendingManagerCount === 0 && declinedManagerCount === 0;
}
