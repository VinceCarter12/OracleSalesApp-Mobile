import { supabase } from './supabase';
import { classifyMeetingMarkerType, type MeetingMarkerType } from './policies/meeting-marker-type';
import { fromRemoteLocationType, fromRemoteMeetingType } from './remote-meeting-mapping';
import { isOfficePinVerified } from './policies/office-pin-policy';
import { getHeldClientIds } from './client-holder-service';
import type { ClientStatus } from '../types';
import type { RemoteLocationType, RemoteMeetingType } from '../types/database';
import type { TeamMapDateWindow, TeamMeetingMarker, TeamOfficePin } from './manager-team-map-service';

/**
 * Guest Records scope (2026-08-22, ADR-067 addendum) — held-client office
 * pins + meeting markers for Manager Maps, structurally parallel to
 * `lib/manager-team-map-service.ts`'s "My Team" fetch but scoped by held
 * CLIENT ids (`getHeldClientIds()`) rather than team AGENT ids. Kept as a
 * separate file/query rather than extended onto `manager-team-map-service.ts`
 * to stay under this repo's 300-line file cap and because the scoping
 * dimension is genuinely different (client-id set vs agent-id set) — same
 * "separate column-limited module" precedent as
 * `lib/manager-tag-along-meetings.ts` / `lib/manager-held-clients.ts`.
 */

export interface GuestMapData {
  officePins: TeamOfficePin[];
  meetingMarkers: TeamMeetingMarker[];
}

const EMPTY_GUEST_MAP_DATA: GuestMapData = { officePins: [], meetingMarkers: [] };

interface GuestOfficePinRow {
  id: string;
  company_name: string;
  office_lat: number | null;
  office_lng: number | null;
  office_pin_updated_at: string | null;
  office_pin_source: 'manual' | 'client_office_meeting' | null;
  assigned_agent_id: string;
}

async function fetchGuestOfficePins(clientIds: string[]): Promise<TeamOfficePin[]> {
  if (clientIds.length === 0) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, company_name, office_lat, office_lng, office_pin_updated_at, office_pin_source, assigned_agent_id')
    .in('id', clientIds)
    .not('office_lat', 'is', null)
    .not('office_lng', 'is', null)
    .neq('status', 'inactive')
    .order('office_pin_updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as GuestOfficePinRow[])
    .filter((row): row is GuestOfficePinRow & { office_lat: number; office_lng: number } => row.office_lat !== null && row.office_lng !== null)
    .map((row) => ({
      id: row.id,
      companyName: row.company_name,
      officeLat: row.office_lat,
      officeLng: row.office_lng,
      officePinUpdatedAt: row.office_pin_updated_at,
      verified: isOfficePinVerified(row.office_pin_source),
      agentId: row.assigned_agent_id,
    }));
}

interface GuestMeetingRow {
  id: string;
  client_id: string | null;
  agent_id: string;
  gps_lat: number | null;
  gps_lng: number | null;
  start_captured_at: string | null;
  meeting_type: RemoteMeetingType | null;
  location_type: RemoteLocationType | null;
  location_name: string | null;
  client_status_at_meeting: string | null;
}

const CLIENT_STATUS_VALUES = new Set<ClientStatus>(['prospect', 'in_progress', 'new', 'existing', 'inactive']);

function toClientStatus(value: string | null): ClientStatus | null {
  return value && CLIENT_STATUS_VALUES.has(value as ClientStatus) ? (value as ClientStatus) : null;
}

type GuestMeetingMarkerNoName = Omit<TeamMeetingMarker, 'clientName'>;

async function fetchGuestMeetingRows(clientIds: string[], dateWindow?: TeamMapDateWindow): Promise<GuestMeetingMarkerNoName[]> {
  if (clientIds.length === 0) return [];
  let query = supabase
    .from('meetings')
    .select('id, client_id, agent_id, gps_lat, gps_lng, start_captured_at, meeting_type, location_type, location_name, client_status_at_meeting')
    .in('client_id', clientIds)
    .not('gps_lat', 'is', null)
    .not('gps_lng', 'is', null)
    .not('start_captured_at', 'is', null);
  if (dateWindow?.startAt) query = query.gte('start_captured_at', dateWindow.startAt);
  if (dateWindow?.endAtExclusive) query = query.lt('start_captured_at', dateWindow.endAtExclusive);
  const { data, error } = await query.order('start_captured_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as GuestMeetingRow[])
    .filter((row): row is GuestMeetingRow & { gps_lat: number; gps_lng: number; start_captured_at: string } =>
      row.gps_lat !== null && row.gps_lng !== null && row.start_captured_at !== null
    )
    .map((row) => ({
      id: row.id,
      clientId: row.client_id,
      gpsLat: row.gps_lat,
      gpsLng: row.gps_lng,
      startCapturedAt: row.start_captured_at,
      markerType: classifyMeetingMarkerType(fromRemoteMeetingType(row.meeting_type), fromRemoteLocationType(row.location_type)),
      locationName: row.location_name,
      clientStatusAtMeeting: toClientStatus(row.client_status_at_meeting),
      agentId: row.agent_id,
    }));
}

async function fetchClientNames(clientIds: string[]): Promise<Map<string, string>> {
  if (clientIds.length === 0) return new Map();
  const { data, error } = await supabase.from('clients').select('id, company_name').in('id', clientIds);
  if (error) throw error;
  return new Map((data ?? []).map((row: { id: string; company_name: string }) => [row.id, row.company_name]));
}

/**
 * Live held-client office pins + meeting GPS markers for Manager Maps'
 * Guest Records scope. Empty (no held clients) is a valid, common result,
 * not an error.
 */
export async function fetchGuestMapData(managerProfileId: string, dateWindow?: TeamMapDateWindow): Promise<GuestMapData> {
  const heldClientIds = await getHeldClientIds(managerProfileId);
  if (heldClientIds.length === 0) return EMPTY_GUEST_MAP_DATA;

  const [officePins, meetingRows] = await Promise.all([
    fetchGuestOfficePins(heldClientIds),
    fetchGuestMeetingRows(heldClientIds, dateWindow),
  ]);
  const clientIds = Array.from(new Set(meetingRows.map((row) => row.clientId).filter((id): id is string => id !== null)));
  const nameByClientId = await fetchClientNames(clientIds);
  const meetingMarkers: TeamMeetingMarker[] = meetingRows.map((row) => ({
    ...row,
    clientName: (row.clientId && nameByClientId.get(row.clientId)) || 'Unknown Client',
  }));

  return { officePins, meetingMarkers };
}
