import { toRemoteLocationType, toRemoteMeetingType, toRemoteOutcome } from './remote-meeting-mapping';
import type { NewMeetingRecord } from './meeting-service';
import type { ClientStatus } from '../types';

/**
 * ADR-026 P1 (interim offline-save fix): a screen falls back to the local
 * `file://` photo URI when `uploadMeetingPhoto()` fails offline, so the
 * meeting is never lost — but that local path is meaningless to Supabase.
 * The remote payload must only ever carry a URL the Storage upload actually
 * produced; anything else (or absent) stays null until Phase C's queued
 * upload retries it.
 */
function remoteMediaUrl(url: string | null | undefined): string | null {
  return url && url.startsWith('http') ? url : null;
}

/**
 * Builds the remote-shaped `meetings` upsert payload. Split out of
 * `lib/meeting-service.ts::createMeeting()` (B-083 fix) to keep that file
 * under the 300-line cap — mobile's own field names don't match the live
 * Supabase `meetings` columns 1:1 (Bugs.md B-011/B-012), same class of gap as
 * clients' `lib/remote-client-mapping.ts` (ADR-018).
 */
export function buildRemoteMeetingPayload(
  id: string,
  record: NewMeetingRecord,
  agendaIds: readonly string[],
  /**
   * B-095 fix (2026-08-08): the client's status read from SQLite immediately
   * before this meeting's INSERT (lib/meeting-service.ts::createMeeting()) —
   * frozen at creation time, never recomputed. Null when `record.client_id`
   * is unset. See lib/client-status.ts::getMeetingLifecycleStatus().
   */
  clientStatusAtMeeting: ClientStatus | null
): Record<string, unknown> {
  return {
    id,
    client_id: record.client_id,
    agent_id: record.agent_id,
    client_status_at_meeting: clientStatusAtMeeting,
    // Tag-along (F-004) and online-meeting (ADR-012) columns — not collected
    // by either mobile flow yet, left null rather than guessed at.
    recorded_by: null,
    online_platform: null,
    gps_lat: record.gps_lat,
    gps_lng: record.gps_lng,
    meeting_type: toRemoteMeetingType(record.meeting_mode),
    agenda: record.agendas,
    // B-083 fix: canonical ids, additive alongside the legacy label array above.
    agenda_ids: agendaIds,
    outcome: toRemoteOutcome(record.outcome),
    photo_url: remoteMediaUrl(record.selfie_url),
    // Existing-client fast path no longer captures a start photo (2026-07-16
    // revision) — the column stays for the remote schema shape, just unset.
    start_photo_url: null,
    start_captured_at: record.start_captured_at ?? null,
    end_photo_url: remoteMediaUrl(record.end_photo_url),
    end_captured_at: record.end_captured_at ?? null,
    end_gps_lat: record.end_gps_lat ?? null,
    end_gps_lng: record.end_gps_lng ?? null,
    meeting_date: record.logged_at,
    // NOT NULL remotely — empty string, never null (matches clients'
    // established pattern in client-service.ts).
    contact_person: record.contactPerson?.trim() || '',
    contact_position: record.contactPosition ?? null,
    location_type: toRemoteLocationType(record.locationType),
    location_name: record.locationName ?? null,
    remarks: record.remarks ?? null,
  };
}
