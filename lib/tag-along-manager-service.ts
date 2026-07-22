import { uuidv4 } from './uuid';
import { enqueueOutboxRow } from './sync/entity-registry';
import type { SQLiteDatabase } from 'expo-sqlite';
import { MAX_COMPANIONS_PER_REQUEST, type InsertCompanionRequestsInput } from './tag-along-service';

// F-205 decision 2 (manager-as-requester tag-along): split out of
// `lib/tag-along-service.ts` (quality-gate fix, that file was over the
// 300-line cap) — the manager-pre-accepted write path, kept separate from
// the normal requester-side writes/reads which stay in that file. Reuses
// its exported `MAX_COMPANIONS_PER_REQUEST` constant and
// `InsertCompanionRequestsInput` type rather than duplicating them.

/**
 * F-205 decision 2 (manager-as-requester tag-along): same INSERT shape as
 * `insertMeetingCompanionRequests()` (`lib/tag-along-service.ts`), except the
 * row lands pre-accepted (`status='accepted'`, `responded_at` set
 * immediately) — when the MANAGER is the requester on their own meeting
 * there's no counterpart to approve it (they'd be approving themselves), so
 * there's no pending/accept-decline gate to go through. Must explicitly send
 * `status`/`responded_at` on the remote payload too (both the local write
 * and the outbox payload) — omitting them, the way
 * `insertMeetingCompanionRequests()` correctly does for the real pending
 * case, would leave the SERVER row defaulting to pending/null forever, same
 * class of bug as B-041/B-044.
 *
 * `insertMeetingCompanionRequests()` itself is deliberately left untouched
 * (byte-identical) — this is a parallel, independent function for the
 * manager path, not a refactor of the existing agent-requests-manager flow
 * (B-053/Pass 2.5).
 *
 * Callers (`lib/meeting-service.ts::createMeeting()`, both Record Meeting
 * screens) must only ever invoke this when `requesterId` refers to a
 * `sales_manager` profile — `getRecentCompanionTagsForInvitee()`
 * (`lib/tag-along-invitee-service.ts`, F-205 item 5) relies on that
 * invariant to distinguish "a manager tagged me in" from "I accepted a
 * request myself" without a schema change.
 */
export async function insertAcceptedMeetingCompanions(
  db: SQLiteDatabase,
  input: InsertCompanionRequestsInput
): Promise<void> {
  const now = new Date().toISOString();
  for (const companion of input.companions.slice(0, MAX_COMPANIONS_PER_REQUEST)) {
    const id = uuidv4();
    const outboxId = uuidv4();
    await db.runAsync(
      `INSERT INTO tag_along_requests
        (id, context, requester_id, invitee_id, invitee_kind, related_client_id, related_meeting_id,
         status, created_at, responded_at, updated_at, sync_status, sync_error, local_updated_at)
       VALUES (?, 'meeting', ?, ?, ?, ?, ?, 'accepted', ?, ?, ?, 'pending', NULL, ?)`,
      [id, input.requesterId, companion.profileId, companion.kind, input.clientId, input.meetingId, now, now, now, now]
    );
    const remotePayload = {
      id,
      context: 'meeting' as const,
      requester_id: input.requesterId,
      invitee_id: companion.profileId,
      invitee_kind: companion.kind,
      related_client_id: input.clientId,
      related_meeting_id: input.meetingId,
      status: 'accepted' as const,
      responded_at: now,
    };
    await enqueueOutboxRow(db, {
      outboxId,
      recordId: id,
      tableName: 'tag_along_requests',
      operation: 'insert',
      payload: JSON.stringify(remotePayload),
      createdAt: now,
      createdOnline: input.createdOnline,
    });
  }
}
