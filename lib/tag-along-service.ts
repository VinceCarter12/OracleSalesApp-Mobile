import { uuidv4 } from './uuid';
import { enqueueOutboxRow } from './sync/entity-registry';
import { getDb } from './db';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { RemoteTagAlongInviteeKind, RemoteTagAlongStatus } from '../types/database';

// ADR-030 Pass 2.5 (requester side): writes for the shared `tag_along_requests`
// table (meeting companions — `context='meeting'` — as of the Pass 2.5
// relocation; F-004's future meeting tag-alongs reuse the same table shape)
// + the client-detail read used for the pending-status chip + the requester's
// own status-center read. Invitee-side accept/decline reads/writes live in
// `lib/tag-along-invitee-service.ts` (ADR-030 Pass 3).

export interface CompanionSelection {
  profileId: string;
  kind: RemoteTagAlongInviteeKind;
}

// ADR-030 decision 2: enforced in BOTH the UI (CompanionPicker, via this same
// exported constant) AND here — this function must never trust a caller to
// have already capped the selection.
export const MAX_COMPANIONS_PER_REQUEST = 2;

interface InsertCompanionRequestsInput {
  clientId: string;
  meetingId: string;
  requesterId: string;
  companions: CompanionSelection[];
  createdOnline: boolean | null;
}

/**
 * Inserts 0–2 `tag_along_requests` rows (local mirror + outbox) for a
 * Record Meeting companion selection. Must be called from WITHIN the same
 * SQLite transaction as the meeting insert it accompanies
 * (lib/meeting-service.ts::createMeeting) — matching that function's
 * existing "meeting write + outbox row, same transaction" pattern — so a
 * crash between the two can never strand a companion request without its
 * outbox row, or vice versa. A no-op when `companions` is empty (the
 * section is fully skippable per ADR-030).
 */
export async function insertMeetingCompanionRequests(
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
       VALUES (?, 'meeting', ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, 'pending', NULL, ?)`,
      [id, input.requesterId, companion.profileId, companion.kind, input.clientId, input.meetingId, now, now, now]
    );
    // B-041/B-044 lesson (this session): client-generated `id` must be sent
    // explicitly, same as clients'/meetings' remote payloads — omitting it
    // (even though the Insert type Omits it) lets Supabase assign its OWN
    // id via `default gen_random_uuid()`, which would never match this local
    // row's id and would duplicate on the next sync-down's ON CONFLICT(id).
    const remotePayload = {
      id,
      context: 'meeting' as const,
      requester_id: input.requesterId,
      invitee_id: companion.profileId,
      invitee_kind: companion.kind,
      // Kept populated (not replaced by the meeting-table join) — an
      // invitee's device never mirrors the requester's meeting row, so
      // related_client_id is still what the client-detail chip joins on.
      related_client_id: input.clientId,
      related_meeting_id: input.meetingId,
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

export interface ClientCompanionRequest {
  id: string;
  inviteeId: string;
  inviteeName: string | null;
  inviteeKind: RemoteTagAlongInviteeKind;
  status: RemoteTagAlongStatus;
  syncStatus: string;
  createdAt: string;
}

interface ClientCompanionRequestRow {
  id: string;
  invitee_id: string;
  invitee_name: string | null;
  invitee_kind: RemoteTagAlongInviteeKind;
  status: RemoteTagAlongStatus;
  sync_status: string;
  created_at: string;
}

/**
 * Reads this client's companion requests made BY the current agent (the
 * requester side — see `lib/tag-along-invitee-service.ts` for the
 * invitee-side read, ADR-030 Pass 3), most recent first, for the client-detail pending-status chip. Context-agnostic
 * (Pass 2.5): reads both `'client_creation'` (legacy) and `'meeting'`
 * (current) requests for the client, so client-detail shows full companion
 * history regardless of which flow created the request. `inviteeName` is
 * a best-effort join against `team_roster_snapshot` — null if that roster
 * entry has since gone stale (teammate transferred off-team, etc.), which
 * the UI must tolerate rather than assume.
 */
export async function getClientCompanionRequests(
  clientId: string,
  requesterId: string
): Promise<ClientCompanionRequest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ClientCompanionRequestRow>(
    `SELECT tar.id, tar.invitee_id, trs.full_name AS invitee_name, tar.invitee_kind,
            tar.status, tar.sync_status, tar.created_at
       FROM tag_along_requests tar
       LEFT JOIN team_roster_snapshot trs ON trs.profile_id = tar.invitee_id
      WHERE tar.related_client_id = ? AND tar.requester_id = ?
      ORDER BY tar.created_at DESC`,
    [clientId, requesterId]
  );
  return rows.map((row) => ({
    id: row.id,
    inviteeId: row.invitee_id,
    inviteeName: row.invitee_name,
    inviteeKind: row.invitee_kind,
    status: row.status,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
  }));
}

export interface MyCompanionRequest extends ClientCompanionRequest {
  clientId: string | null;
  clientName: string | null;
  relatedMeetingId: string | null;
}

interface MyCompanionRequestRow extends ClientCompanionRequestRow {
  client_id: string | null;
  client_name: string | null;
  related_meeting_id: string | null;
}

/**
 * Reads ALL of the current agent's own companion requests (both contexts),
 * most recent first — powers the "Tag-Along Status" view-only status center
 * (`app/(tabs)/more/tag-along.tsx`, Pass 2.5). Unlike
 * `getClientCompanionRequests`, this is not scoped to a single client.
 * `clientName` is a best-effort join against the local `clients` mirror —
 * null if that client row isn't (or is no longer) present locally.
 */
export async function getMyCompanionRequests(requesterId: string): Promise<MyCompanionRequest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MyCompanionRequestRow>(
    `SELECT tar.id, tar.invitee_id, trs.full_name AS invitee_name, tar.invitee_kind,
            tar.status, tar.sync_status, tar.created_at,
            tar.related_client_id AS client_id, c.company_name AS client_name,
            tar.related_meeting_id
       FROM tag_along_requests tar
       LEFT JOIN team_roster_snapshot trs ON trs.profile_id = tar.invitee_id
       LEFT JOIN clients c ON c.id = tar.related_client_id
      WHERE tar.requester_id = ?
      ORDER BY tar.created_at DESC`,
    [requesterId]
  );
  return rows.map((row) => ({
    id: row.id,
    inviteeId: row.invitee_id,
    inviteeName: row.invitee_name,
    inviteeKind: row.invitee_kind,
    status: row.status,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    clientId: row.client_id,
    clientName: row.client_name,
    relatedMeetingId: row.related_meeting_id,
  }));
}

/**
 * Reads companion requests attached to a SPECIFIC meeting (via
 * `related_meeting_id`), most recent first — powers Meeting Detail's
 * tag-along status banner. Mirrors `getClientCompanionRequests` exactly,
 * just scoped to one meeting instead of one client — a meeting only ever
 * has the requester's own requests attached to it (the invitee-side view
 * lives in `lib/tag-along-invitee-service.ts`, ADR-030 Pass 3), so no
 * `requesterId` filter is needed here the way the client-scoped read has one.
 */
export async function getMeetingCompanionRequests(meetingId: string): Promise<ClientCompanionRequest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ClientCompanionRequestRow>(
    `SELECT tar.id, tar.invitee_id, trs.full_name AS invitee_name, tar.invitee_kind,
            tar.status, tar.sync_status, tar.created_at
       FROM tag_along_requests tar
       LEFT JOIN team_roster_snapshot trs ON trs.profile_id = tar.invitee_id
      WHERE tar.related_meeting_id = ?
      ORDER BY tar.created_at DESC`,
    [meetingId]
  );
  return rows.map((row) => ({
    id: row.id,
    inviteeId: row.invitee_id,
    inviteeName: row.invitee_name,
    inviteeKind: row.invitee_kind,
    status: row.status,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
  }));
}

export type CompanionRequestDisplayStatus = 'pending_offline' | 'pending_synced' | 'accepted' | 'declined' | 'cancelled';

/**
 * Distinguishes "queued locally, hasn't reached Supabase yet" from "synced,
 * still awaiting the invitee's answer" per ADR-030's offline-behavior spec.
 * Terminal statuses (accepted/declined/cancelled) pass through unchanged —
 * their real UI treatment lives in the Manager Tag-Along screen
 * (`app/(manager)/tag-along.tsx`, via `lib/tag-along-invitee-service.ts`,
 * ADR-030 Pass 3), but this must not crash or mislabel a row that already
 * has one.
 */
export function companionRequestDisplayStatus(request: Pick<ClientCompanionRequest, 'status' | 'syncStatus'>): CompanionRequestDisplayStatus {
  if (request.status === 'pending') {
    return request.syncStatus === 'synced' ? 'pending_synced' : 'pending_offline';
  }
  return request.status;
}

export const COMPANION_REQUEST_STATUS_LABELS: Record<CompanionRequestDisplayStatus, string> = {
  pending_offline: 'Pending (hindi pa nase-send — offline)',
  pending_synced: 'Pending (hinihintay ang sagot)',
  accepted: 'Tinanggap',
  declined: 'Tinanggihan',
  cancelled: 'Kinansela',
};

/**
 * Badge tone tokens (BIZLINK_COLORS keys, not literal hexes, so a future
 * palette tweak stays one file away) for the client-detail chip. Terminal
 * tones (accepted/declined/cancelled) are here for completeness — populated
 * once `lib/tag-along-invitee-service.ts` (ADR-030 Pass 3) writes those
 * rows; this requester-side module only ever produces `pending_*`.
 */
export const COMPANION_REQUEST_BADGE_TONES: Record<CompanionRequestDisplayStatus, { background: 'soft' | 'tintA'; color: 'muted' | 'ink' | 'brand' | 'red' }> = {
  pending_offline: { background: 'soft', color: 'muted' },
  pending_synced: { background: 'tintA', color: 'ink' },
  accepted: { background: 'tintA', color: 'brand' },
  declined: { background: 'soft', color: 'red' },
  cancelled: { background: 'soft', color: 'muted' },
};
