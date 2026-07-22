import type { Meeting, MeetingMode, MeetingOutcome } from '../types';

// Local SQLite mirrors mobile's own domain field names (agendas, meeting_mode,
// selfie_url, logged_at) — the remote column-name/value translation only
// happens at outbox-push time (lib/meeting-service.ts), same split as clients
// (lib/local-client-mapper.ts vs lib/remote-client-mapping.ts).

export interface LocalMeetingRow {
  id: string;
  client_id: string | null;
  client_name?: string | null;
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
  logged_at: string;
  created_at: string;
  contact_person: string | null;
  contact_position: string | null;
  location_type: string | null;
  location_name: string | null;
  remarks: string | null;
  sync_status: string;
}

export function rowToMeeting(row: LocalMeetingRow): Meeting {
  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.client_name ?? null,
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
    logged_at: row.logged_at,
    created_at: row.created_at,
    contact_person: row.contact_person,
    contact_position: row.contact_position,
    location_type: row.location_type,
    location_name: row.location_name,
    remarks: row.remarks,
    sync_status: row.sync_status,
  };
}
