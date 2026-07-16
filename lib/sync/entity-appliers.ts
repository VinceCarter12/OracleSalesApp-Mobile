import { normalizeCompanyName } from '../company-name';
import { fromRemoteSalesChannel, fromRemoteStatus } from '../remote-client-mapping';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { RemoteClientStatus, RemoteCustomerType, RemoteSalesChannel } from '../../types/database';

// T-002/T-005/T-014: applies a synced-down remote row to the local SQLite
// mirror. Moved out of sync-down.ts unchanged (just relocated) so the
// entity registry (./entity-registry.ts) can reference these by name
// instead of sync-down.ts branching on table_name directly.

/** Only overwrites a local row with server data if it doesn't exist yet, or is already 'synced' — never clobbers a pending/conflict/failed local write. */
export async function upsertSyncedClient(db: SQLiteDatabase, row: Record<string, unknown>, now: string): Promise<void> {
  const companyName = row.company_name as string;
  await db.runAsync(
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
      fromRemoteStatus(
        (row.status as RemoteClientStatus) ?? 'active',
        (row.customer_type as RemoteCustomerType) ?? null
      ),
      row.assigned_agent_id as string,
      (row.details_deadline_at as string) ?? null,
      (row.details_completed_at as string) ?? null,
      (row.inactive_reason as string) ?? null,
      row.created_at as string,
      row.updated_at as string,
      now,
    ]
  );
}

export async function upsertSyncedMeeting(db: SQLiteDatabase, row: Record<string, unknown>, now: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO meetings
      (id, client_id, agent_id, gps_lat, gps_lng, selfie_url, agendas, outcome,
       meeting_mode, start_photo_url, start_captured_at, end_photo_url, end_captured_at,
       logged_at, created_at, sync_status, local_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
     ON CONFLICT(id) DO UPDATE SET
       client_id = excluded.client_id, agent_id = excluded.agent_id, gps_lat = excluded.gps_lat,
       gps_lng = excluded.gps_lng, selfie_url = excluded.selfie_url, agendas = excluded.agendas,
       outcome = excluded.outcome, meeting_mode = excluded.meeting_mode,
       start_photo_url = excluded.start_photo_url, start_captured_at = excluded.start_captured_at,
       end_photo_url = excluded.end_photo_url, end_captured_at = excluded.end_captured_at,
       logged_at = excluded.logged_at, created_at = excluded.created_at,
       sync_status = 'synced', sync_error = NULL, local_updated_at = excluded.local_updated_at
     WHERE meetings.sync_status = 'synced'`,
    [
      row.id as string,
      (row.client_id as string) ?? null,
      row.agent_id as string,
      row.gps_lat as number,
      row.gps_lng as number,
      (row.selfie_url as string) ?? null,
      JSON.stringify(row.agendas ?? []),
      (row.outcome as string) ?? null,
      (row.meeting_mode as string) ?? null,
      (row.start_photo_url as string) ?? null,
      (row.start_captured_at as string) ?? null,
      (row.end_photo_url as string) ?? null,
      (row.end_captured_at as string) ?? null,
      row.logged_at as string,
      row.created_at as string,
      now,
    ]
  );
}
