import type { SQLiteDatabase } from 'expo-sqlite';
import { shouldMeetingBecomeValid } from './policies/tag-along-validity-policy';

// ADR-046 (correction addendum, 2026-07-28): DB-touching half of the
// `validity_status` gate — the pure decision logic lives in
// lib/policies/tag-along-validity-policy.ts so it stays testable under the
// repo's node-only vitest config. Split into its own file (rather than
// growing lib/sync/entity-appliers.ts or the already-291-line
// lib/tag-along-service.ts past the 300-line cap) — same precedent as
// the same small-service split used by other tag-along persistence helpers.

interface ManagerTagAlongCounts {
  pending: number | null;
  declined: number | null;
}

/**
 * Called from lib/sync/entity-appliers.ts::upsertSyncedTagAlongRequest
 * whenever a meeting-context MANAGER-kind tag-along row syncs down (either
 * side: the requester pulling their own request back, or — same registry
 * pull — the accept/decline response itself). Recomputes ALL manager-kind
 * gates attached to that meeting (not just the one row that just synced) and
 * flips `validity_status` to 'valid' only when none remain pending or
 * declined. Never touches a meeting already 'valid', and never DELETEs the
 * meeting row — a declined gate simply leaves it 'pending_confirmation'.
 */
export async function reconcileMeetingValidityAfterManagerTagAlong(
  db: SQLiteDatabase,
  meetingId: string
): Promise<void> {
  const counts = await db.getFirstAsync<ManagerTagAlongCounts>(
    `SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) AS declined
       FROM tag_along_requests
      WHERE related_meeting_id = ? AND invitee_kind = 'manager' AND context = 'meeting'`,
    [meetingId]
  );
  if (!counts) return;
  if (!shouldMeetingBecomeValid(counts.pending ?? 0, counts.declined ?? 0)) return;

  await db.runAsync(
    `UPDATE meetings SET validity_status = 'valid' WHERE id = ? AND validity_status = 'pending_confirmation'`,
    [meetingId]
  );
}
