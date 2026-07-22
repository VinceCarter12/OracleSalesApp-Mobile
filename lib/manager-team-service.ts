import { supabase } from './supabase';
import {
  buildTeamAgents,
  clientStatusLabel,
  countCreatedSince,
  mapClientRowToTeamClient,
  mapMeetingRowToTeamMeeting,
  type ClientRow,
  type MeetingRow,
  type ProfileRow,
} from './team-remote-mappers';
import { fromRemoteStatus } from './remote-client-mapping';
import type { TeamAgent, TeamClient, TeamMeeting } from '../types';

// B-054 Phase 1: the first real (non-mock) Manager team-wide read path for
// clients/meetings, following `lib/manager-dashboard-service.ts`'s existing
// live-Supabase-query style. A manager's own device only mirrors THEIR OWN
// local SQLite data (ADR-001) — team-wide numbers can only come from a live
// Supabase query, same reasoning as the dashboard service.

const AGENT_ROLES = ['sales_specialist', 'rsr'] as const;
const EXCLUDED_CLIENT_STATUSES = new Set(['lost', 'deleted']);
const TREND_WINDOW_DAYS = 7;

export interface TeamOverview {
  agents: TeamAgent[];
  clients: TeamClient[];
  meetings: TeamMeeting[];
  /**
   * Real "this week" deltas for the Manager Home stat captions (B-054 Phase 1
   * item 6, replacing the old fabricated "+3 this week"/"+12.1% vs last mo."
   * strings) — 0 is a valid, non-fabricated answer.
   */
  newProspectsThisWeek: number;
  newTeamClientsThisWeek: number;
}

async function fetchTeamProfiles(teamId: string): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, team_id')
    .eq('team_id', teamId)
    .in('role', AGENT_ROLES);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

async function fetchClientsAndMeetings(
  agentIds: string[]
): Promise<{ clients: ClientRow[]; meetings: MeetingRow[] }> {
  if (agentIds.length === 0) return { clients: [], meetings: [] };

  const [{ data: clientRows, error: clientError }, { data: meetingRows, error: meetingError }] = await Promise.all([
    supabase
      .from('clients')
      .select(
        'id, company_name, contact_person, contact_number, office_address, customer_type, sales_channel, status, assigned_agent_id, details_deadline_at, created_at'
      )
      .in('assigned_agent_id', agentIds),
    supabase
      .from('meetings')
      .select(
        'id, client_id, agent_id, meeting_type, location_type, location_name, gps_lat, gps_lng, agenda, remarks, outcome, contact_person, contact_position, meeting_date, start_captured_at, end_captured_at, created_at'
      )
      .in('agent_id', agentIds),
  ]);
  if (clientError) throw clientError;
  if (meetingError) throw meetingError;

  return {
    clients: (clientRows ?? []) as ClientRow[],
    meetings: (meetingRows ?? []) as MeetingRow[],
  };
}

/**
 * `teamId`/`managerProfileId` come from `useSession()` — RLS scopes what
 * actually comes back (B-047's broad-read profiles policy + the Migration
 * 016 clients/meetings agent-scoped policies), this query just asks for the
 * manager's own team plus their own profile id.
 */
export async function fetchTeamOverview(teamId: string, managerProfileId: string): Promise<TeamOverview> {
  const profiles = await fetchTeamProfiles(teamId);
  // ADR-020: a manager can create clients directly (assigned to their own
  // profileId) — included in the clients/meetings query so those clients
  // don't vanish from "team clients", but NOT in `profiles`/`buildTeamAgents`
  // (the manager isn't a roster entry on their own team screen).
  const agentIds = [...profiles.map((p) => p.id), managerProfileId];

  const { clients: allClients, meetings } = await fetchClientsAndMeetings(agentIds);
  // Lost/deleted clients are Executive/reports territory, not this list.
  const clients = allClients.filter((c) => !EXCLUDED_CLIENT_STATUSES.has(c.status));

  const now = new Date();
  const clientStatusById = new Map(clients.map((c) => [c.id, fromRemoteStatus(c.status, c.customer_type)]));

  const weekAgo = new Date(now.getTime() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const prospectClients = clients.filter((c) => clientStatusById.get(c.id) === 'prospect');
  const nonProspectClients = clients.filter((c) => {
    const status = clientStatusById.get(c.id);
    return status === 'new' || status === 'existing';
  });

  return {
    agents: buildTeamAgents(profiles, clients, meetings, now),
    clients: clients.map((c) => mapClientRowToTeamClient(c, now)),
    meetings: meetings.map((m) => {
      const status = m.client_id ? clientStatusById.get(m.client_id) : undefined;
      return mapMeetingRowToTeamMeeting(m, status ? clientStatusLabel(status) : '—');
    }),
    newProspectsThisWeek: countCreatedSince(prospectClients, weekAgo),
    newTeamClientsThisWeek: countCreatedSince(nonProspectClients, weekAgo),
  };
}

/** Account screen's "New clients" stat (Part B item 8) — manager's OWN clients only, `customer_type='new'`. */
export async function getManagerOwnNewClientsCount(managerProfileId: string): Promise<number> {
  const { count, error } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_agent_id', managerProfileId)
    .eq('customer_type', 'new');
  if (error) throw error;
  return count ?? 0;
}
