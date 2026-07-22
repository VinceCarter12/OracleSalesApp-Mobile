import { normalizeCompanyName } from '../company-name';
import { fromRemoteSalesChannel, fromRemoteStatus } from '../remote-client-mapping';
import { fromRemoteLocationType, fromRemoteMeetingType, fromRemoteOutcome } from '../remote-meeting-mapping';
import { uuidv4 } from '../uuid';
import { enqueueSyncAuditRow } from './audit-log';
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  RemoteClientStatus,
  RemoteCustomerType,
  RemoteSalesChannel,
  RemoteMeetingType,
} from '../../types/database';

// B-031/logged_at crash fix (2026-07-18): this applier was reading remote
// rows through mobile's own local field names (`selfie_url`, `agendas`,
// `meeting_mode`, `logged_at`) instead of the actual Supabase columns
// (`photo_url`, `agenda`, `meeting_type`, `meeting_date` — see
// meeting-service.ts's `remotePayload`), same class of gap as B-011/B-012.
// `logged_at` specifically is `NOT NULL` locally (db.ts) — reading the
// always-`undefined` `row.logged_at` bound NULL and crashed every sync-down
// once a meeting round-tripped through Supabase.

// T-002/T-005/T-014: applies a synced-down remote row to the local SQLite
// mirror. Moved out of sync-down.ts unchanged (just relocated) so the
// entity registry (./entity-registry.ts) can reference these by name
// instead of sync-down.ts branching on table_name directly.

/**
 * ADR-026 P1 (B-032 follow-up... actually the lost/deleted mapping gap):
 * `lost`/`deleted` clients aren't part of mobile's `ClientStatus` domain
 * (CLIENT_STATUSES) and never will be without a wireframe pass (ADR-010) —
 * they must simply stop being an agent-visible client. Removing the local
 * mirror row (same 'synced'-only guard as the upsert below, so an unsynced
 * local edit is never silently discarded) is the correct "remove from
 * agent" behavior without inventing new lifecycle states or UI.
 */
async function removeLostOrDeletedClient(db: SQLiteDatabase, agentId: string, id: string): Promise<void> {
  const result = await db.runAsync("DELETE FROM clients WHERE id = ? AND sync_status = 'synced'", [id]);
  if (result.changes > 0) {
    await enqueueLwwAudit(db, agentId, 'clients', id, 'delete');
  }
}

/**
 * ADR-026 P3 item 13: closes the `lww_overwrite_applied` audit gap — until
 * now nothing ever enqueued this outcome, even though the entity-appliers'
 * `WHERE sync_status = 'synced'` guard silently overwrites a locally-synced
 * row whenever the server's copy has since changed (last-write-wins). Scope
 * is clients only this pass — see `upsertSyncedMeeting()` below for why
 * meetings are excluded. The try/catch is critical: an audit failure must
 * never fail or skip the real state-changing write it's reporting on, since
 * this always runs AFTER that write already succeeded.
 */
async function enqueueLwwAudit(
  db: SQLiteDatabase,
  agentId: string,
  entityTable: 'clients',
  entityId: string,
  operation: 'update' | 'delete'
): Promise<void> {
  try {
    await enqueueSyncAuditRow(db, {
      deviceOpId: uuidv4(),
      userId: agentId,
      entityTable,
      entityId,
      operation,
      outcome: 'lww_overwrite_applied',
      attemptCount: 0,
      errorCode: null,
      errorDetail: null,
    });
  } catch (err) {
    console.error('[entity-appliers] LWW audit enqueue failed:', err);
  }
}

/** Only overwrites a local row with server data if it doesn't exist yet, or is already 'synced' — never clobbers a pending/conflict/failed local write. */
export async function upsertSyncedClient(
  db: SQLiteDatabase,
  row: Record<string, unknown>,
  now: string,
  agentId: string
): Promise<void> {
  const remoteStatus = (row.status as RemoteClientStatus) ?? 'active';
  if (remoteStatus === 'lost' || remoteStatus === 'deleted') {
    await removeLostOrDeletedClient(db, agentId, row.id as string);
    return;
  }

  const priorRow = await db.getFirstAsync<{ sync_status: string; updated_at: string | null }>(
    'SELECT sync_status, updated_at FROM clients WHERE id = ?',
    [row.id as string]
  );

  const companyName = row.company_name as string;
  const result = await db.runAsync(
    `INSERT INTO clients
      (id, company_name, normalized_name, contact_person, position, contact_number, address_line1,
       address_line2, landmark, province, city, customer_type, sales_channel, status,
       agent_id, details_deadline_at, details_completed_at, inactive_reason,
       created_at, updated_at, sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
     ON CONFLICT(id) DO UPDATE SET
       company_name = excluded.company_name, normalized_name = excluded.normalized_name,
       contact_person = excluded.contact_person, position = excluded.position,
       contact_number = excluded.contact_number, address_line1 = excluded.address_line1,
       address_line2 = excluded.address_line2, landmark = excluded.landmark,
       province = excluded.province, city = excluded.city, customer_type = excluded.customer_type,
       sales_channel = excluded.sales_channel, status = excluded.status, agent_id = excluded.agent_id,
       details_deadline_at = excluded.details_deadline_at, details_completed_at = excluded.details_completed_at,
       inactive_reason = excluded.inactive_reason, created_at = excluded.created_at,
       updated_at = excluded.updated_at, sync_status = 'synced', sync_error = NULL, local_updated_at = excluded.local_updated_at
     WHERE clients.sync_status = 'synced'`,
    [
      row.id as string,
      companyName,
      normalizeCompanyName(companyName),
      (row.contact_person as string) ?? null,
      (row.contact_position as string) ?? null,
      (row.contact_number as string) ?? null,
      (row.address_line1 as string) ?? null,
      (row.address_line2 as string) ?? null,
      (row.landmark as string) ?? null,
      (row.province as string) ?? null,
      (row.city as string) ?? null,
      // Local `customer_type` mirrors mobile's unused legacy Dealer-type
      // field — the remote column of the same name means something
      // different (see remote-client-mapping.ts), so it's never round-tripped.
      null,
      fromRemoteSalesChannel((row.sales_channel as RemoteSalesChannel) ?? null),
      fromRemoteStatus(remoteStatus, (row.customer_type as RemoteCustomerType) ?? null),
      row.assigned_agent_id as string,
      (row.details_deadline_at as string) ?? null,
      (row.details_completed_at as string) ?? null,
      (row.inactive_reason as string) ?? null,
      row.created_at as string,
      row.updated_at as string,
      now,
    ]
  );

  // LWW-overwrite audit (ADR-026 P3 item 13): a prior row existed, was
  // already 'synced' locally (i.e. eligible for the WHERE guard above to
  // overwrite it), its `updated_at` genuinely changed, and the upsert
  // actually applied — that combination means a real overwrite happened,
  // not a no-op re-confirmation of identical data.
  const remoteUpdatedAt = row.updated_at as string;
  if (
    priorRow !== null &&
    priorRow.sync_status === 'synced' &&
    priorRow.updated_at !== remoteUpdatedAt &&
    result.changes > 0
  ) {
    await enqueueLwwAudit(db, agentId, 'clients', row.id as string, 'update');
  }
}

/**
 * ADR-026 P3 item 13 (meetings excluded this pass): meetings have no
 * `updated_at` column locally (lib/db.ts) or remotely — there's no cheap
 * change-signal to gate an LWW audit on without a schema migration.
 * `agentId` is accepted (unused) only to keep the entity-registry's
 * `applyRemoteRow` signature uniform across entities. Unlock condition: add
 * an `updated_at` column via a future migration if this becomes a real need
 * — mobile has no meeting-edit-after-creation flow today, so overwrites are
 * near-impossible in practice.
 */
export async function upsertSyncedMeeting(
  db: SQLiteDatabase,
  row: Record<string, unknown>,
  now: string,
  // Unused: kept for entity-registry signature uniformity, see doc comment above.
  agentId: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO meetings
      (id, client_id, agent_id, gps_lat, gps_lng, selfie_url, agendas, outcome,
       meeting_mode, start_photo_url, start_captured_at, end_photo_url, end_captured_at,
       end_gps_lat, end_gps_lng, logged_at, created_at, contact_person, contact_position,
       location_type, location_name, remarks, sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
     ON CONFLICT(id) DO UPDATE SET
       client_id = excluded.client_id, agent_id = excluded.agent_id, gps_lat = excluded.gps_lat,
       gps_lng = excluded.gps_lng, selfie_url = excluded.selfie_url, agendas = excluded.agendas,
       outcome = excluded.outcome, meeting_mode = excluded.meeting_mode,
       start_photo_url = excluded.start_photo_url, start_captured_at = excluded.start_captured_at,
       end_photo_url = excluded.end_photo_url, end_captured_at = excluded.end_captured_at,
       end_gps_lat = excluded.end_gps_lat, end_gps_lng = excluded.end_gps_lng,
       logged_at = excluded.logged_at, created_at = excluded.created_at,
       contact_person = excluded.contact_person, contact_position = excluded.contact_position,
       location_type = excluded.location_type, location_name = excluded.location_name,
       remarks = excluded.remarks,
       sync_status = 'synced', sync_error = NULL, local_updated_at = excluded.local_updated_at
     WHERE meetings.sync_status = 'synced'`,
    [
      row.id as string,
      (row.client_id as string) ?? null,
      row.agent_id as string,
      row.gps_lat as number,
      row.gps_lng as number,
      (row.photo_url as string) ?? null,
      JSON.stringify(row.agenda ?? []),
      fromRemoteOutcome((row.outcome as string) ?? null),
      fromRemoteMeetingType((row.meeting_type as RemoteMeetingType) ?? null),
      (row.start_photo_url as string) ?? null,
      (row.start_captured_at as string) ?? null,
      (row.end_photo_url as string) ?? null,
      (row.end_captured_at as string) ?? null,
      (row.end_gps_lat as number) ?? null,
      (row.end_gps_lng as number) ?? null,
      row.meeting_date as string,
      row.created_at as string,
      (row.contact_person as string) || null,
      (row.contact_position as string) ?? null,
      fromRemoteLocationType(row.location_type as string | null | undefined),
      (row.location_name as string) ?? null,
      (row.remarks as string) ?? null,
      now,
    ]
  );
}

/**
 * ADR-030: LWW-safe upsert for the shared `tag_along_requests` table
 * (client-creation companions today; F-004's future meeting tag-alongs
 * reuse the same table via the `context` column). Migration 019's RLS
 * partitions writers by state transition — requester can only move
 * `pending → cancelled`, invitee can only move `pending → accepted/declined`
 * — so there are never two conflicting local writers on the same row, and
 * the same overwrite-if-synced guard used by `upsertSyncedClient`/
 * `upsertSyncedMeeting` above is sufficient; no extra conflict logic needed.
 */
export async function upsertSyncedTagAlongRequest(
  db: SQLiteDatabase,
  row: Record<string, unknown>,
  now: string,
  // Unused: kept for entity-registry signature uniformity, see upsertSyncedMeeting's doc comment above.
  agentId: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO tag_along_requests
      (id, context, requester_id, invitee_id, invitee_kind, related_client_id, related_meeting_id,
       status, created_at, responded_at, updated_at, sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
     ON CONFLICT(id) DO UPDATE SET
       context = excluded.context, requester_id = excluded.requester_id, invitee_id = excluded.invitee_id,
       invitee_kind = excluded.invitee_kind, related_client_id = excluded.related_client_id,
       related_meeting_id = excluded.related_meeting_id, status = excluded.status,
       created_at = excluded.created_at, responded_at = excluded.responded_at, updated_at = excluded.updated_at,
       sync_status = 'synced', sync_error = NULL, local_updated_at = excluded.local_updated_at
     WHERE tag_along_requests.sync_status = 'synced'`,
    [
      row.id as string,
      row.context as string,
      row.requester_id as string,
      row.invitee_id as string,
      row.invitee_kind as string,
      (row.related_client_id as string) ?? null,
      (row.related_meeting_id as string) ?? null,
      row.status as string,
      row.created_at as string,
      (row.responded_at as string) ?? null,
      row.updated_at as string,
      now,
    ]
  );
}
