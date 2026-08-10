import type { Meeting, MeetingMode, MeetingOutcome, MeetingValidityStatus } from '../types';

// Local SQLite mirrors mobile's own domain field names (agendas, meeting_mode,
// selfie_url, logged_at) — the remote column-name/value translation only
// happens at outbox-push time (lib/meeting-service.ts), same split as clients
// (lib/local-client-mapper.ts vs lib/remote-client-mapping.ts).

export interface LocalMeetingRow {
  id: string;
  client_id: string | null;
  /**
   * The name snapshotted onto the meeting row itself (SQLite v31), stamped at
   * the moment a lost/deleted client is removed from this device. This is the
   * ONLY name still available once that client row is gone — see
   * removeLostOrDeletedClient() in lib/sync/entity-appliers.ts.
   */
  client_name?: string | null;
  /**
   * The name resolved through `JOIN clients` at read time. Deliberately a
   * DIFFERENT key from `client_name`: the read queries do `SELECT m.*`, which
   * now yields a real `client_name` column, so aliasing the joined value to
   * the same name would emit two identically-named columns and leave which one
   * survives up to the driver. Live value wins in rowToMeeting (it tracks
   * renames); the snapshot is the fallback.
   */
  joined_client_name?: string | null;
  agent_id: string;
  gps_lat: number;
  gps_lng: number;
  selfie_url: string | null;
  agendas: string;
  outcome: string | null;
  meeting_mode: string | null;
  start_photo_url: string | null;
  start_captured_at: string | null;
  end_photo_url: string | null;
  end_captured_at: string | null;
  end_gps_lat?: number | null;
  end_gps_lng?: number | null;
  selfie_captured_at?: string | null;
  selfie_gps_lat?: number | null;
  selfie_gps_lng?: number | null;
  logged_at: string;
  created_at: string;
  contact_person: string | null;
  contact_position: string | null;
  location_type: string | null;
  location_name: string | null;
  remarks: string | null;
  sync_status: string;
  // ADR-046 (SQLite v15): NOT NULL DEFAULT 'valid' on the table, but every
  // row read through here predates that migration until it actually runs on
  // the device — optional so a stale `SELECT m.*` result during the exact
  // migration transaction can never crash the mapper.
  validity_status?: string;
  // B-095 fix: nullable — absent entirely on rows recorded before Migration
  // v26 added the column (SQLite returns undefined for a column that didn't
  // exist on that row's original INSERT, not null).
  client_status_at_meeting?: string | null;
}

export function rowToMeeting(row: LocalMeetingRow): Meeting {
  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.joined_client_name ?? row.client_name ?? null,
    agent_id: row.agent_id,
    gps_lat: row.gps_lat,
    gps_lng: row.gps_lng,
    selfie_url: row.selfie_url,
    agendas: JSON.parse(row.agendas || '[]'),
    outcome: (row.outcome as MeetingOutcome | null) ?? null,
    meeting_mode: (row.meeting_mode as MeetingMode | undefined) ?? undefined,
    start_photo_url: row.start_photo_url,
    start_captured_at: row.start_captured_at,
    end_photo_url: row.end_photo_url,
    end_captured_at: row.end_captured_at,
    end_gps_lat: row.end_gps_lat ?? null,
    end_gps_lng: row.end_gps_lng ?? null,
    selfie_captured_at: row.selfie_captured_at ?? null,
    selfie_gps_lat: row.selfie_gps_lat ?? null,
    selfie_gps_lng: row.selfie_gps_lng ?? null,
    logged_at: row.logged_at,
    created_at: row.created_at,
    contact_person: row.contact_person,
    contact_position: row.contact_position,
    location_type: row.location_type,
    location_name: row.location_name,
    remarks: row.remarks,
    sync_status: row.sync_status,
    validity_status: (row.validity_status as MeetingValidityStatus | undefined) ?? 'valid',
    client_status_at_meeting: (row.client_status_at_meeting as Meeting['client_status_at_meeting']) ?? null,
  };
}
