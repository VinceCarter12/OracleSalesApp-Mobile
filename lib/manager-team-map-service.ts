import { supabase } from './supabase';
import { classifyMeetingMarkerType, type MeetingMarkerType } from './policies/meeting-marker-type';
import { fromRemoteLocationType, fromRemoteMeetingType } from './remote-meeting-mapping';
import { isOfficePinVerified } from './policies/office-pin-policy';
import type { ClientStatus } from '../types';
import type { RemoteLocationType, RemoteMeetingType } from '../types/database';

// Maps manager-only extension (2026-08-10): Wireframe-Manager-BizLink.html
// `#s-maps` adds a "My Team" scope on top of the Sales/RSR office-map shell.
// A manager's device only mirrors THEIR OWN local SQLite data (ADR-001) — the
// existing `lib/use-office-pins.ts`/`lib/use-meeting-map-markers.ts` hooks
// stay exactly as-is for "My Records". Team members' pins/meetings can only
// come from a live Supabase read, same reasoning + query shape as
// `lib/manager-team-service.ts::fetchClientsAndMeetings()` — deliberately
// NOT reusing that function directly (it selects a much wider client/meeting
// column set for the Team/Clients screens); this module selects only the
// map-relevant columns.

const AGENT_ROLES = ['sales_specialist', 'rsr'] as const;

export interface TeamOfficePin {
  id: string;
  companyName: string;
  officeLat: number;
  officeLng: number;
  verified: boolean;
  agentId: string;
}

export interface TeamMeetingMarker {
  id: string;
  clientId: string | null;
  clientName: string;
  gpsLat: number;
  gpsLng: number;
  startCapturedAt: string;
  markerType: MeetingMarkerType;
  locationName: string | null;
  clientStatusAtMeeting: ClientStatus | null;
  agentId: string;
}

export interface TeamMapDateWindow {
  startAt?: string;
  endAtExclusive?: string;
}

/** id + display name for the "Teammate" picker under the Manager Maps "My Team" scope (Vince, 2026-08-10). */
export interface TeamMember {
  id: string;
  fullName: string;
}

export interface TeamMapData {
  officePins: TeamOfficePin[];
  meetingMarkers: TeamMeetingMarker[];
  teamAgents: TeamMember[];
}

const EMPTY_TEAM_MAP_DATA: TeamMapData = { officePins: [], meetingMarkers: [], teamAgents: [] };

interface ProfileRow {
  id: string;
  full_name: string;
}

async function fetchTeamAgents(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('team_id', teamId)
    .in('role', AGENT_ROLES);
  if (error) throw error;
  return ((data ?? []) as ProfileRow[]).map((row) => ({ id: row.id, fullName: row.full_name }));
}

interface TeamOfficePinRow {
  id: string;
  company_name: string;
  office_lat: number | null;
  office_lng: number | null;
  office_pin_source: 'manual' | 'client_office_meeting' | null;
  assigned_agent_id: string;
}

async function fetchTeamOfficePins(agentIds: string[]): Promise<TeamOfficePin[]> {
  if (agentIds.length === 0) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, company_name, office_lat, office_lng, office_pin_source, assigned_agent_id')
    .in('assigned_agent_id', agentIds)
    .not('office_lat', 'is', null)
    .not('office_lng', 'is', null)
    .neq('status', 'inactive');
  if (error) throw error;
  return ((data ?? []) as TeamOfficePinRow[])
    .filter((row): row is TeamOfficePinRow & { office_lat: number; office_lng: number } => row.office_lat !== null && row.office_lng !== null)
    .map((row) => ({
      id: row.id,
      companyName: row.company_name,
      officeLat: row.office_lat,
      officeLng: row.office_lng,
      verified: isOfficePinVerified(row.office_pin_source),
      agentId: row.assigned_agent_id,
    }));
}

interface TeamMeetingRow {
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

type TeamMeetingMarkerNoName = Omit<TeamMeetingMarker, 'clientName'>;

async function fetchTeamMeetingRows(agentIds: string[], dateWindow?: TeamMapDateWindow): Promise<TeamMeetingMarkerNoName[]> {
  if (agentIds.length === 0) return [];
  let query = supabase
    .from('meetings')
    .select('id, client_id, agent_id, gps_lat, gps_lng, start_captured_at, meeting_type, location_type, location_name, client_status_at_meeting')
    .in('agent_id', agentIds)
    .not('gps_lat', 'is', null)
    .not('gps_lng', 'is', null)
    .not('start_captured_at', 'is', null);
  if (dateWindow?.startAt) query = query.gte('start_captured_at', dateWindow.startAt);
  if (dateWindow?.endAtExclusive) query = query.lt('start_captured_at', dateWindow.endAtExclusive);
  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as TeamMeetingRow[])
    .filter((row): row is TeamMeetingRow & { gps_lat: number; gps_lng: number; start_captured_at: string } =>
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
 * Live team-scoped office pins + meeting GPS markers for Manager Maps' "My
 * Team" scope (excludes the manager's own records — those come from the
 * existing local SQLite hooks, unchanged from the Sales/RSR shell). Never
 * mocked: an empty/failed team (no `teamId`, no agents) returns an empty
 * result rather than a fabricated placeholder.
 */
export async function fetchTeamMapData(teamId: string | null, dateWindow?: TeamMapDateWindow): Promise<TeamMapData> {
  if (!teamId) return EMPTY_TEAM_MAP_DATA;
  const teamAgents = await fetchTeamAgents(teamId);
  const agentIds = teamAgents.map((agent) => agent.id);
  const [officePins, meetingRows] = await Promise.all([
    fetchTeamOfficePins(agentIds),
    fetchTeamMeetingRows(agentIds, dateWindow),
  ]);
  const clientIds = Array.from(new Set(meetingRows.map((row) => row.clientId).filter((id): id is string => id !== null)));
  const nameByClientId = await fetchClientNames(clientIds);
  const meetingMarkers: TeamMeetingMarker[] = meetingRows.map((row) => ({
    ...row,
    clientName: (row.clientId && nameByClientId.get(row.clientId)) || 'Unknown Client',
  }));

  return { officePins, meetingMarkers, teamAgents };
}
