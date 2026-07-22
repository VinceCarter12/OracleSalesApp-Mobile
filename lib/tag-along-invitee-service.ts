import { getDb } from './db';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import { isLikelyOnline } from './sync/connectivity';
import { uuidv4 } from './uuid';
import type { RemoteTagAlongInviteeKind, RemoteTagAlongStatus } from '../types/database';

// ADR-030 Pass 3 (invitee side): reads/writes for the Manager Tag-Along
// screen (`app/(manager)/tag-along.tsx`) — mirrors `lib/tag-along-service.ts`'s
// requester-side patterns exactly, just with the join direction flipped
// (`requester_id` instead of `invitee_id`) and the write direction flipped
// (accept/decline instead of create). Reuses that file's exported
// types/constants (`RemoteTagAlongInviteeKind`, `RemoteTagAlongStatus`,
// `companionRequestDisplayStatus`, `COMPANION_REQUEST_STATUS_LABELS`,
// `COMPANION_REQUEST_BADGE_TONES`) rather than duplicating them.

export class StaleCompanionRequestError extends Error {
  constructor(requestId: string) {
    super(`Tag-along request ${requestId} was already responded to (or no longer pending).`);
    this.name = 'StaleCompanionRequestError';
  }
}

export interface IncomingCompanionRequest {
  id: string;
  requesterId: string;
  requesterName: string | null;
  inviteeKind: RemoteTagAlongInviteeKind;
  status: RemoteTagAlongStatus;
  syncStatus: string;
  createdAt: string;
  clientId: string | null;
  clientName: string | null;
  relatedMeetingId: string | null;
}

interface IncomingCompanionRequestRow {
  id: string;
  requester_id: string;
  requester_name: string | null;
  invitee_kind: RemoteTagAlongInviteeKind;
  status: RemoteTagAlongStatus;
  sync_status: string;
  created_at: string;
  client_id: string | null;
  client_name: string | null;
  related_meeting_id: string | null;
}

/**
 * Reads companion requests made TO the current invitee (manager or
 * teammate), most recent first — powers the Manager Tag-Along screen's
 * "Mga request" section. `requesterName` is a best-effort join against
 * `team_roster_snapshot` — null if that roster entry has since gone stale.
 * `clientName` is a best-effort join against the local `clients` mirror —
 * null if that client row isn't (or is no longer) present locally, which
 * managers must tolerate today (B-054: no full team-client mirror yet).
 */
export async function getIncomingCompanionRequests(inviteeId: string): Promise<IncomingCompanionRequest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<IncomingCompanionRequestRow>(
    `SELECT tar.id, tar.requester_id, trs.full_name AS requester_name, tar.invitee_kind,
            tar.status, tar.sync_status, tar.created_at,
            tar.related_client_id AS client_id, c.company_name AS client_name,
            tar.related_meeting_id
       FROM tag_along_requests tar
       LEFT JOIN team_roster_snapshot trs ON trs.profile_id = tar.requester_id
       LEFT JOIN clients c ON c.id = tar.related_client_id
      WHERE tar.invitee_id = ?
      ORDER BY tar.created_at DESC`,
    [inviteeId]
  );
  return rows.map((row) => ({
    id: row.id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    inviteeKind: row.invitee_kind,
    status: row.status,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    clientId: row.client_id,
    clientName: row.client_name,
    relatedMeetingId: row.related_meeting_id,
  }));
}

export interface UpdateCompanionRequestStatusInput {
  requestId: string;
  actorProfileId: string;
  decision: 'accepted' | 'declined';
}

/**
 * Accept/decline write-back for the invitee side (ADR-030 Pass 3). Mirrors
 * `lib/client-service.ts::updateClientInfo()`'s transaction shape exactly.
 * The `AND status = 'pending'` guard on the local UPDATE prevents a
 * double-tap/race from producing two conflicting responses — if 0 rows are
 * affected, the request was already responded to (or never existed for this
 * invitee), so this throws `StaleCompanionRequestError` and deliberately does
 * NOT enqueue an outbox row for a write that never actually happened.
 */
export async function updateCompanionRequestStatus(input: UpdateCompanionRequestStatusInput): Promise<void> {
  const db = await getDb();
  const outboxId = uuidv4();
  const now = new Date().toISOString();

  const remotePayload = {
    status: input.decision,
    responded_at: now,
    updated_at: now,
  };

  const createdOnline = await isLikelyOnline();
  let updatedRows = 0;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `UPDATE tag_along_requests
        SET status = ?, responded_at = ?, updated_at = ?, local_updated_at = ?, sync_status = 'pending'
       WHERE id = ? AND invitee_id = ? AND status = 'pending'`,
      [input.decision, now, now, now, input.requestId, input.actorProfileId]
    );
    updatedRows = result.changes;
    if (updatedRows === 0) return;

    await enqueueOutboxRow(db, {
      outboxId,
      recordId: input.requestId,
      tableName: 'tag_along_requests',
      operation: 'update',
      payload: JSON.stringify(remotePayload),
      createdAt: now,
      createdOnline,
    });
  });

  if (updatedRows === 0) {
    throw new StaleCompanionRequestError(input.requestId);
  }

  runSync(input.actorProfileId).catch((err) =>
    console.error('[tag-along-invitee-service] background sync failed:', JSON.stringify(err, null, 2))
  );
}

export interface RecentManagerTag {
  id: string;
  requesterName: string | null;
  clientName: string | null;
  createdAt: string;
}

interface RecentManagerTagRow {
  id: string;
  requester_name: string | null;
  client_name: string | null;
  created_at: string;
}

/**
 * F-205 item 5 (quality-gate fix): reads this agent's own `tag_along_requests`
 * rows where they're the invitee AND the row was pre-accepted by a manager
 * tagging themselves in as requester (`insertAcceptedMeetingCompanions()`,
 * F-205 decision 2) — NOT a normal request the agent accepted themselves via
 * `updateCompanionRequestStatus()`.
 *
 * `status = 'accepted'` alone is NOT sufficient: `updateCompanionRequestStatus()`
 * also sets `status = 'accepted'` whenever an agent manually accepts ANY
 * normal pending request (requested by a manager OR a teammate, per the
 * B-053 flow), producing a row indistinguishable from a manager-pre-accept
 * row by status alone. The real distinguishing signal is the REQUESTER's
 * role: `insertAcceptedMeetingCompanions()` is only ever called with
 * `requesterId = record.agent_id` where that agent IS a manager recording
 * their own meeting (`companionsPreAccepted: role === 'sales_manager'`, see
 * `app/(tabs)/meetings/record.tsx` and `record-visit.tsx`) — a manager is
 * NEVER the `requester_id` on a normal pending-flow row, since the only two
 * call sites that create `tag_along_requests` rows (`createMeeting()` in
 * both Record Meeting screens) always route a manager-as-requester through
 * the pre-accepted path, never the pending one. So joining
 * `team_roster_snapshot` on `requester_id` and requiring `role =
 * 'sales_manager'` is a fully reliable signal, without a schema change.
 * (Best-effort: if the roster hasn't synced yet on this device, the join
 * misses and the row is excluded — same tolerated staleness as this file's
 * other roster joins.) Most recent first, capped to a small count for the
 * Notifications feed.
 */
export async function getRecentCompanionTagsForInvitee(inviteeId: string, limit = 5): Promise<RecentManagerTag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecentManagerTagRow>(
    `SELECT tar.id, trs.full_name AS requester_name, c.company_name AS client_name, tar.created_at
       FROM tag_along_requests tar
       JOIN team_roster_snapshot trs ON trs.profile_id = tar.requester_id
       LEFT JOIN clients c ON c.id = tar.related_client_id
      WHERE tar.invitee_id = ?
        AND tar.context = 'meeting'
        AND tar.status = 'accepted'
        AND trs.role = 'sales_manager'
      ORDER BY tar.created_at DESC
      LIMIT ?`,
    [inviteeId, limit]
  );
  return rows.map((row) => ({
    id: row.id,
    requesterName: row.requester_name,
    clientName: row.client_name,
    createdAt: row.created_at,
  }));
}
