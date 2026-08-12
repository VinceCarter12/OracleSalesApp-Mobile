import { normalizeCompanyName } from '../company-name';
import { fromRemoteSalesChannel, fromRemoteStatus } from '../remote-client-mapping';
import { fromRemoteLocationType, fromRemoteMeetingType, fromRemoteOutcome } from '../remote-meeting-mapping';
import { uuidv4 } from '../uuid';
import { enqueueSyncAuditRow } from './audit-log';
import { reconcileMeetingValidityAfterManagerTagAlong } from '../tag-along-validity-service';
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
 *
 * The client goes; the agent's MEETINGS with it stay (db.ts v31). Stamping the
 * company name onto those rows is done here, immediately before the delete,
 * because this is the last moment the name is available on-device — the server
 * row being applied still carries it, and a heartbeat later the local clients
 * row is gone and nothing can resolve the name again. `WHERE client_name IS
 * NULL` keeps it a one-time stamp: a client that is lost, claimed by someone
 * else, and lost again must not have its historical name rewritten.
 */
async function removeLostOrDeletedClient(
  db: SQLiteDatabase,
  agentId: string,
  id: string,
  companyName: string | null
): Promise<void> {
  if (companyName) {
    await db.runAsync(
      'UPDATE meetings SET client_name = ? WHERE client_id = ? AND client_name IS NULL',
      [companyName, id]
    );
  }
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
    await removeLostOrDeletedClient(
      db,
      agentId,
      row.id as string,
      (row.company_name as string | null) ?? null
    );
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
       created_at, updated_at, cycle_id, in_progress_at,
       office_lat, office_lng, office_pin_updated_at, office_pin_source, minor_notes, sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
     ON CONFLICT(id) DO UPDATE SET
       company_name = excluded.company_name, normalized_name = excluded.normalized_name,
       contact_person = excluded.contact_person, position = excluded.position,
       contact_number = excluded.contact_number, address_line1 = excluded.address_line1,
       address_line2 = excluded.address_line2, landmark = excluded.landmark,
       province = excluded.province, city = excluded.city, customer_type = excluded.customer_type,
       sales_channel = excluded.sales_channel, status = excluded.status, agent_id = excluded.agent_id,
       details_deadline_at = excluded.details_deadline_at, details_completed_at = excluded.details_completed_at,
       inactive_reason = excluded.inactive_reason, created_at = excluded.created_at,
       updated_at = excluded.updated_at, cycle_id = excluded.cycle_id, in_progress_at = excluded.in_progress_at,
       office_lat = excluded.office_lat, office_lng = excluded.office_lng,
       office_pin_updated_at = excluded.office_pin_updated_at, office_pin_source = excluded.office_pin_source,
       minor_notes = excluded.minor_notes,
       sync_status = 'synced', sync_error = NULL, local_updated_at = excluded.local_updated_at
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
      // ADR-045 (Migration 035/038): read-only, server-authoritative — never
      // written by mobile itself. `current_cycle_id` is the remote column
      // name; local column is shortened to `cycle_id` (lib/db.ts v14).
      (row.current_cycle_id as string) ?? null,
      (row.in_progress_at as string) ?? null,
      // Batch 4: permanent office pin, additive Supabase columns — see
      // [[Office-Location-Spec-2026-07-29]]. Never written by mobile except
      // through lib/office-pin-service.ts; this sync-down path only mirrors
      // whatever the server currently has.
      (row.office_lat as number) ?? null,
      (row.office_lng as number) ?? null,
      (row.office_pin_updated_at as string) ?? null,
      (row.office_pin_source as string) ?? null,
      // ADR-052 (Batch 6 Phase 5): approval-exempt free-text field, written
      // directly (never through client_edit_requests) — plain round-trip,
      // same as every other non-domain-translated column above.
      (row.minor_notes as string) ?? null,
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
       location_type, location_name, remarks, cycle_id, agenda_ids, client_status_at_meeting,
       sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
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
       remarks = excluded.remarks, cycle_id = excluded.cycle_id, agenda_ids = excluded.agenda_ids,
       client_status_at_meeting = excluded.client_status_at_meeting,
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
      // ADR-045 (Migration 038 Part B): read-only, server-authoritative
      // (stamped by the `stamp_meeting_cycle` trigger) — mobile never sets
      // either of these itself at meeting-creation time.
      (row.cycle_id as string) ?? null,
      JSON.stringify(row.agenda_ids ?? []),
      // B-095 fix (2026-08-08): mirrors the frozen-at-creation status
      // written by lib/meeting-service.ts::createMeeting() — this sync-down
      // path only ever reflects whatever the server already has, never
      // recomputes it.
      (row.client_status_at_meeting as string) ?? null,
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

  // ADR-046 (correction addendum): only a meeting-context MANAGER tag-along
  // ever gates a meeting's validity_status — a teammate-kind or
  // client_creation-context row never has a linked meeting to reconcile.
  if (
    row.context === 'meeting' &&
    row.invitee_kind === 'manager' &&
    typeof row.related_meeting_id === 'string'
  ) {
    await reconcileMeetingValidityAfterManagerTagAlong(db, row.related_meeting_id);
  }
}

/**
 * ADR-052 (Batch 6 Phase 5): applies a synced-down `client_edit_requests`
 * row — mostly a Manager's decision (`status`/`review_note`/`reviewed_by`/
 * `reviewed_at`) flowing back down to the requester's own device, since
 * `applyScope` (entity-registry.ts) restricts this pull to the requester's
 * own rows. `WHERE status != 'superseded'` guards the one local-only
 * terminal state (lib/sync/outbox-status.ts's non-retryable-failure
 * classification) from ever being reopened by a stray sync-down — if the
 * row is 'superseded' locally, the create push permanently failed and this
 * id was never actually created server-side, so no real row should ever
 * come back down for it in practice; the guard is defense-in-depth only.
 * `agentId` is unused (signature uniformity, see upsertSyncedMeeting above).
 */
export async function upsertSyncedClientEditRequest(
  db: SQLiteDatabase,
  row: Record<string, unknown>,
  now: string,
  agentId: string
): Promise<void> {
  void agentId;
  await db.runAsync(
    `INSERT INTO client_edit_requests
      (id, client_id, requested_by, changes, status, review_note, reviewed_by, reviewed_at,
       base_updated_at, base_assigned_agent_id, created_at, updated_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status, review_note = excluded.review_note,
       reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at,
       updated_at = excluded.updated_at, synced_at = excluded.synced_at
     WHERE client_edit_requests.status != 'superseded'`,
    [
      row.id as string,
      row.client_id as string,
      row.requested_by as string,
      JSON.stringify(row.changes ?? {}),
      (row.status as string) ?? 'pending',
      (row.review_note as string) ?? null,
      (row.reviewed_by as string) ?? null,
      (row.reviewed_at as string) ?? null,
      row.base_updated_at as string,
      row.base_assigned_agent_id as string,
      // NOT NULL columns locally — fall back to `now` if the remote row ever
      // omits them (observed: a synced-down row with no `updated_at` tripped
      // the SQLite NOT NULL constraint and permanently failed this pull).
      (row.created_at as string | undefined) ?? now,
      (row.updated_at as string | undefined) ?? (row.created_at as string | undefined) ?? now,
      now,
    ]
  );
}

export async function upsertSyncedJointManagerRequest(db: SQLiteDatabase, row: Record<string, unknown>, now: string, agentId: string): Promise<void> {
  void agentId;
  await db.runAsync(`INSERT INTO joint_manager_requests
    (id, client_id, requester_id, origin_team_id, manager_ids, action_kind, action_payload,
     base_updated_at, status, required_count, created_at, updated_at, applied_at, sync_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at,
      applied_at=excluded.applied_at, sync_status='synced'`, [
    row.id as string, row.client_id as string, row.requester_id as string,
    (row.origin_team_id as string) ?? null, JSON.stringify(row.manager_ids ?? []),
    (row.action_kind as string) ?? 'holder_assignment', JSON.stringify(row.action_payload ?? {}),
    row.base_updated_at as string, (row.status as string) ?? 'pending',
    (row.required_count as number) ?? 1, (row.created_at as string) ?? now,
    (row.updated_at as string) ?? now, (row.applied_at as string) ?? null,
  ]);
}

export async function upsertSyncedJointManagerDecision(db: SQLiteDatabase, row: Record<string, unknown>, now: string, agentId: string): Promise<void> {
  void agentId;
  await db.runAsync(`INSERT INTO joint_manager_request_decisions
    (id, request_id, manager_id, decision, decided_at, synced_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET decision=excluded.decision, decided_at=excluded.decided_at, synced_at=excluded.synced_at`, [
    row.id as string, row.request_id as string, row.manager_id as string,
    (row.decision as string) ?? 'pending', (row.decided_at as string) ?? null, now,
  ]);
}

export async function upsertSyncedClientRecordHolder(db: SQLiteDatabase, row: Record<string, unknown>, now: string, agentId: string): Promise<void> {
  void agentId;
  await db.runAsync(`INSERT INTO client_record_holders
    (client_id, manager_id, manager_name, active, origin_team_id, updated_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id, manager_id) DO UPDATE SET manager_name=excluded.manager_name,
      active=excluded.active, origin_team_id=excluded.origin_team_id,
      updated_at=excluded.updated_at, synced_at=excluded.synced_at`, [
    row.client_id as string, row.manager_id as string, (row.manager_name as string) ?? null,
    row.active === false ? 0 : 1, (row.origin_team_id as string) ?? null,
    (row.updated_at as string) ?? now, now,
  ]);
}

/**
 * F-007 (web 043/045/046): LWW-safe upsert of a synced-down collection_visit
 * into the local mirror. Read path (Phase 1) — the field app never invents
 * these (the admin publishes the list), so the same overwrite-if-synced guard
 * as the appliers above is sufficient. `agentId` is unused (signature
 * uniformity). `client_name`/`area`/`claimed_by_name` are denormalized on the
 * remote row (migrations 045/046), so no client/profile read is needed.
 */
export async function upsertSyncedCollectionVisit(
  db: SQLiteDatabase,
  row: Record<string, unknown>,
  now: string,
  agentId: string
): Promise<void> {
  void agentId;
  await db.runAsync(
    `INSERT INTO collection_visits
      (id, client_id, client_name, area, status, scheduled_for, amount_due, collector_id,
       amount_collected, payment_method, payment_photo_url, delivery_receipt_photo_url,
       gps_lat, gps_lng, remarks, rescheduled_to, visited_at, claimed_by, claimed_at,
       claimed_by_name, is_additional, additional_received_at, additional_seen_at,
       created_at, updated_at, sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
     ON CONFLICT(id) DO UPDATE SET
       client_id = excluded.client_id, client_name = excluded.client_name, area = excluded.area,
       status = excluded.status, scheduled_for = excluded.scheduled_for, amount_due = excluded.amount_due,
       collector_id = excluded.collector_id, amount_collected = excluded.amount_collected,
       payment_method = excluded.payment_method, payment_photo_url = excluded.payment_photo_url,
       delivery_receipt_photo_url = excluded.delivery_receipt_photo_url, gps_lat = excluded.gps_lat,
       gps_lng = excluded.gps_lng, remarks = excluded.remarks, rescheduled_to = excluded.rescheduled_to,
       visited_at = excluded.visited_at, claimed_by = excluded.claimed_by, claimed_at = excluded.claimed_at,
       claimed_by_name = excluded.claimed_by_name, is_additional = excluded.is_additional,
       additional_received_at = excluded.additional_received_at, additional_seen_at = excluded.additional_seen_at,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at, sync_status = 'synced', sync_error = NULL,
       local_updated_at = excluded.local_updated_at
     WHERE collection_visits.sync_status = 'synced'`,
    [
      row.id as string,
      (row.client_id as string) ?? null,
      (row.client_name as string) ?? null,
      (row.area as string) ?? null,
      (row.status as string) ?? 'pending',
      (row.scheduled_for as string) ?? null,
      (row.amount_due as number) ?? null,
      (row.collector_id as string) ?? null,
      (row.amount_collected as number) ?? null,
      (row.payment_method as string) ?? null,
      (row.payment_photo_url as string) ?? null,
      (row.delivery_receipt_photo_url as string) ?? null,
      (row.gps_lat as number) ?? null,
      (row.gps_lng as number) ?? null,
      (row.remarks as string) ?? null,
      (row.rescheduled_to as string) ?? null,
      (row.visited_at as string) ?? null,
      (row.claimed_by as string) ?? null,
      (row.claimed_at as string) ?? null,
      (row.claimed_by_name as string) ?? null,
      // web's `is_additional` (Additional Collection contract). Absent until
      // web ships the column — defaults to 0, so pre-contract rows are normal.
      row.is_additional ? 1 : 0,
      // web 068 ack timestamps — mirrored read-only; mobile only ever WRITES
      // them via the RPCs (never here). `additional_seen_pending` is local-only
      // and deliberately NOT in this upsert, so a sync-down never clears a
      // still-unsynced "seen" intent.
      (row.additional_received_at as string) ?? null,
      (row.additional_seen_at as string) ?? null,
      (row.created_at as string) ?? null,
      (row.updated_at as string) ?? null,
      now,
    ]
  );
}

/** F-007 (web 044/045/046): LWW-safe upsert of a synced-down purchase_order. Booleans stored 0/1. See upsertSyncedCollectionVisit. */
export async function upsertSyncedPurchaseOrder(
  db: SQLiteDatabase,
  row: Record<string, unknown>,
  now: string,
  agentId: string
): Promise<void> {
  void agentId;
  await db.runAsync(
    `INSERT INTO purchase_orders
      (id, po_number, client_id, client_name, area, status, scheduled_for, cod, cod_due,
       driver_id, truck_plate, sequence_no, receiver_name, receiver_signature_url, time_in,
       time_out, proof_url, backload_photo_url, gps_lat, gps_lng, remarks, cod_amount,
       cod_method, cod_photo_url, cod_remitted, claimed_by, claimed_at, claimed_by_name,
       created_at, updated_at, sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
     ON CONFLICT(id) DO UPDATE SET
       po_number = excluded.po_number, client_id = excluded.client_id, client_name = excluded.client_name,
       area = excluded.area, status = excluded.status, scheduled_for = excluded.scheduled_for,
       cod = excluded.cod, cod_due = excluded.cod_due, driver_id = excluded.driver_id,
       truck_plate = excluded.truck_plate, sequence_no = excluded.sequence_no,
       receiver_name = excluded.receiver_name, receiver_signature_url = excluded.receiver_signature_url,
       time_in = excluded.time_in, time_out = excluded.time_out, proof_url = excluded.proof_url,
       backload_photo_url = excluded.backload_photo_url, gps_lat = excluded.gps_lat, gps_lng = excluded.gps_lng,
       remarks = excluded.remarks, cod_amount = excluded.cod_amount, cod_method = excluded.cod_method,
       cod_photo_url = excluded.cod_photo_url, cod_remitted = excluded.cod_remitted,
       claimed_by = excluded.claimed_by, claimed_at = excluded.claimed_at, claimed_by_name = excluded.claimed_by_name,
       created_at = excluded.created_at, updated_at = excluded.updated_at,
       sync_status = 'synced', sync_error = NULL, local_updated_at = excluded.local_updated_at
     WHERE purchase_orders.sync_status = 'synced'`,
    [
      row.id as string,
      (row.po_number as string) ?? null,
      (row.client_id as string) ?? null,
      (row.client_name as string) ?? null,
      (row.area as string) ?? null,
      (row.status as string) ?? 'pending',
      (row.scheduled_for as string) ?? null,
      row.cod ? 1 : 0,
      (row.cod_due as number) ?? null,
      (row.driver_id as string) ?? null,
      (row.truck_plate as string) ?? null,
      (row.sequence_no as number) ?? null,
      (row.receiver_name as string) ?? null,
      (row.receiver_signature_url as string) ?? null,
      (row.time_in as string) ?? null,
      (row.time_out as string) ?? null,
      (row.proof_url as string) ?? null,
      (row.backload_photo_url as string) ?? null,
      (row.gps_lat as number) ?? null,
      (row.gps_lng as number) ?? null,
      (row.remarks as string) ?? null,
      (row.cod_amount as number) ?? null,
      (row.cod_method as string) ?? null,
      (row.cod_photo_url as string) ?? null,
      row.cod_remitted ? 1 : 0,
      (row.claimed_by as string) ?? null,
      (row.claimed_at as string) ?? null,
      (row.claimed_by_name as string) ?? null,
      (row.created_at as string) ?? null,
      (row.updated_at as string) ?? null,
      now,
    ]
  );
}

/** Serializes a remote UUID[] (PostgREST returns a JS array) to the JSON text the local mirror stores. Defensive against a null/non-array. */
function toIdJson(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

/** F-007 (web 043): LWW-safe upsert of a synced-down `remittances` row. The collector reads back their own (RLS); `visit_ids` (UUID[]) is stored as JSON text. See upsertSyncedCollectionVisit for the overwrite-if-synced guard. */
export async function upsertSyncedRemittance(
  db: SQLiteDatabase,
  row: Record<string, unknown>,
  now: string,
  agentId: string
): Promise<void> {
  void agentId;
  await db.runAsync(
    `INSERT INTO remittances
      (id, collector_id, destination, amount_remitted, amount_collected, status,
       receiver_name, signed_proof_url, receiver_signature_url, visit_ids,
       submitted_at, created_at, sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
     ON CONFLICT(id) DO UPDATE SET
       collector_id = excluded.collector_id, destination = excluded.destination,
       amount_remitted = excluded.amount_remitted, amount_collected = excluded.amount_collected,
       status = excluded.status, receiver_name = excluded.receiver_name,
       signed_proof_url = excluded.signed_proof_url, receiver_signature_url = excluded.receiver_signature_url,
       visit_ids = excluded.visit_ids, submitted_at = excluded.submitted_at, created_at = excluded.created_at,
       sync_status = 'synced', sync_error = NULL, local_updated_at = excluded.local_updated_at
     WHERE remittances.sync_status = 'synced'`,
    [
      row.id as string,
      (row.collector_id as string) ?? null,
      (row.destination as string) ?? 'office',
      (row.amount_remitted as number) ?? 0,
      (row.amount_collected as number) ?? 0,
      (row.status as string) ?? 'submitted',
      (row.receiver_name as string) ?? null,
      (row.signed_proof_url as string) ?? null,
      (row.receiver_signature_url as string) ?? null,
      toIdJson(row.visit_ids),
      (row.submitted_at as string) ?? null,
      (row.created_at as string) ?? null,
      now,
    ]
  );
}

/** F-007 (web 044): LWW-safe upsert of a synced-down `cod_remittances` row. `po_ids` (UUID[]) stored as JSON text. */
export async function upsertSyncedCodRemittance(
  db: SQLiteDatabase,
  row: Record<string, unknown>,
  now: string,
  agentId: string
): Promise<void> {
  void agentId;
  await db.runAsync(
    `INSERT INTO cod_remittances
      (id, driver_id, amount_remitted, amount_collected, status, receiver_name,
       receiver_signature_url, po_ids, submitted_at, created_at, sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
     ON CONFLICT(id) DO UPDATE SET
       driver_id = excluded.driver_id, amount_remitted = excluded.amount_remitted,
       amount_collected = excluded.amount_collected, status = excluded.status,
       receiver_name = excluded.receiver_name, receiver_signature_url = excluded.receiver_signature_url,
       po_ids = excluded.po_ids, submitted_at = excluded.submitted_at, created_at = excluded.created_at,
       sync_status = 'synced', sync_error = NULL, local_updated_at = excluded.local_updated_at
     WHERE cod_remittances.sync_status = 'synced'`,
    [
      row.id as string,
      (row.driver_id as string) ?? null,
      (row.amount_remitted as number) ?? 0,
      (row.amount_collected as number) ?? 0,
      (row.status as string) ?? 'submitted',
      (row.receiver_name as string) ?? null,
      (row.receiver_signature_url as string) ?? null,
      toIdJson(row.po_ids),
      (row.submitted_at as string) ?? null,
      (row.created_at as string) ?? null,
      now,
    ]
  );
}
