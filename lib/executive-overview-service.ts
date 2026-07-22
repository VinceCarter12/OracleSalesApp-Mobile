import { supabase } from './supabase';
import {
  buildTeamAgents,
  initialsOf,
  mapClientRowToTeamClient,
  mapMeetingRowToTeamMeeting,
  type ClientRow,
  type MeetingRow,
  type ProfileRow,
} from './team-remote-mappers';
import { fromRemoteStatus } from './remote-client-mapping';
import { avatarPaletteFor } from './avatar-palette';
import { isRsrTeam, PRESENTATION_AGENDA } from '../types';
import type { ExecAgent, ExecClient, ExecManager, ExecMeeting } from '../types';

// B-054 Phase 2: the first real (non-mock) Executive company-wide read path —
// same live-Supabase-query style as lib/manager-team-service.ts (Phase 1),
// but with NO team_id filter: an Executive's own device only mirrors THEIR
// OWN local SQLite data (ADR-001), so company-wide numbers can only come from
// a live query, same reasoning as the Manager path. RLS is broad
// ("Authenticated read profiles"/clients/meetings, confirmed in Phase 1) so a
// single unscoped query per table is all that's needed.

const AGENT_ROLES = ['sales_specialist', 'rsr'] as const;
const MANAGER_ROLE = 'sales_manager';
// Lost/deleted clients have no ClientStatus counterpart (CLIENT_STATUSES) —
// excluded from the ExecClient list same as lib/manager-team-service.ts, but
// 'lost' is still counted separately for `totals.lostCompanyWide` below.
const EXCLUDED_CLIENT_STATUSES = new Set(['deleted']);

export interface ExecutiveTotals {
  prospects: number;
  clients: number;
  meetingsThisMonth: number;
  successfulThisMonth: number;
  lostCompanyWide: number;
  agents: number;
}

export interface ExecutiveOverview {
  managers: ExecManager[];
  agents: ExecAgent[];
  clients: ExecClient[];
  meetings: ExecMeeting[];
  totals: ExecutiveTotals;
}

function isSameMonth(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return d.getMonth() === reference.getMonth() && d.getFullYear() === reference.getFullYear();
}

async function fetchAllProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, team_id')
    .in('role', [...AGENT_ROLES, MANAGER_ROLE]);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

async function fetchAllClientsAndMeetings(): Promise<{ clients: ClientRow[]; meetings: MeetingRow[] }> {
  const [{ data: clientRows, error: clientError }, { data: meetingRows, error: meetingError }] = await Promise.all([
    supabase
      .from('clients')
      .select(
        'id, company_name, contact_person, contact_number, office_address, customer_type, sales_channel, status, assigned_agent_id, details_deadline_at, created_at'
      ),
    supabase
      .from('meetings')
      .select(
        'id, client_id, agent_id, meeting_type, location_type, location_name, gps_lat, gps_lng, agenda, remarks, outcome, contact_person, contact_position, meeting_date, start_captured_at, end_captured_at, created_at'
      ),
  ]);
  if (clientError) throw clientError;
  if (meetingError) throw meetingError;

  return {
    clients: (clientRows ?? []) as ClientRow[],
    meetings: (meetingRows ?? []) as MeetingRow[],
  };
}

/** `managerProfiles[].team_id` → `profiles.id`, used to null-safely derive `ExecAgent.managerId`/`ExecClient.managerId`. */
function buildManagerIdByTeamId(managerProfiles: ProfileRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of managerProfiles) {
    if (m.team_id) map.set(m.team_id, m.id);
  }
  return map;
}

function buildExecManagers(
  managerProfiles: ProfileRow[],
  agentProfiles: ProfileRow[],
  activeClients: ClientRow[],
  meetings: MeetingRow[]
): ExecManager[] {
  return managerProfiles.map((m) => {
    const teamAgentIds = new Set(agentProfiles.filter((a) => a.team_id === m.team_id).map((a) => a.id));
    const managerClients = activeClients.filter((c) => teamAgentIds.has(c.assigned_agent_id));
    const managerMeetings = meetings.filter((mt) => teamAgentIds.has(mt.agent_id));
    return {
      id: m.id,
      name: m.full_name,
      initials: initialsOf(m.full_name),
      avatar: avatarPaletteFor(m.id),
      meetings: managerMeetings.length,
      clients: managerClients.length,
      agentCount: teamAgentIds.size,
      track: isRsrTeam(m.team_id) ? 'rsr' : 'sales',
    };
  });
}

function buildExecAgents(
  agentProfiles: ProfileRow[],
  activeClients: ClientRow[],
  meetings: MeetingRow[],
  managerIdByTeamId: Map<string, string>,
  now: Date
): ExecAgent[] {
  const baseAgents = buildTeamAgents(
    agentProfiles.map((p) => ({ id: p.id, full_name: p.full_name })),
    activeClients,
    meetings,
    now
  );
  const teamIdByAgentId = new Map(agentProfiles.map((p) => [p.id, p.team_id]));
  return baseAgents.map((agent) => {
    const teamId = teamIdByAgentId.get(agent.id) ?? null;
    return {
      id: agent.id,
      managerId: (teamId && managerIdByTeamId.get(teamId)) ?? null,
      name: agent.name,
      initials: agent.initials,
      avatar: avatarPaletteFor(agent.id),
      meetings: agent.meetingsThisMonth,
      clients: agent.activeClients,
      rate: agent.successRate,
    };
  });
}

/** `assigned_agent_id` → agent's `team_id` → manager profile sharing that `team_id`, null-safe throughout. */
function buildExecClients(
  activeClients: ClientRow[],
  teamIdByAgentId: Map<string, string | null>,
  managerIdByTeamId: Map<string, string>,
  now: Date
): ExecClient[] {
  return activeClients.map((row) => {
    const teamClient = mapClientRowToTeamClient(row, now);
    const agentTeamId = teamIdByAgentId.get(row.assigned_agent_id) ?? null;
    return {
      id: teamClient.id,
      name: teamClient.name,
      agentId: teamClient.agentId,
      managerId: (agentTeamId && managerIdByTeamId.get(agentTeamId)) ?? null,
      status: teamClient.status,
      channel: teamClient.channel,
      checklist: teamClient.checklist,
      createdAt: teamClient.createdAt,
    };
  });
}

/** B-060 addendum: `client_id` → `company_name`, built from ALL clients (not just active ones) so a meeting tied to a since-lost/deleted client still resolves a name for the Executive Maps list. */
function buildCompanyNameByClientId(allClients: ClientRow[]): Map<string, string> {
  return new Map(allClients.map((c) => [c.id, c.company_name]));
}

function buildExecMeetings(meetings: MeetingRow[], companyNameByClientId: Map<string, string>): ExecMeeting[] {
  return meetings.map((row) => {
    // ExecMeeting has no `custType` field (unlike TeamMeeting) — the '—'
    // placeholder is discarded, never surfaced.
    const teamMeeting = mapMeetingRowToTeamMeeting(row, '—');
    return {
      id: teamMeeting.id,
      clientId: teamMeeting.clientId,
      companyName: (row.client_id && companyNameByClientId.get(row.client_id)) || '—',
      agentId: teamMeeting.agentId,
      date: teamMeeting.date,
      time: teamMeeting.time,
      location: teamMeeting.location,
      contact: teamMeeting.contact,
      position: teamMeeting.position,
      agenda: teamMeeting.agenda,
      remarks: teamMeeting.remarks,
      outcome: teamMeeting.outcome,
      gps: teamMeeting.gps,
      synced: teamMeeting.synced,
      meetingDateIso: teamMeeting.meetingDateIso,
    };
  });
}

/**
 * Same B-001 rule as lib/team-remote-mappers.ts::computeTeamClientProgress()
 * (100% once a meeting's agenda included "Product / company presentation",
 * 0% otherwise) — a small standalone copy rather than reusing that function
 * directly, because `ExecClient`/`ExecMeeting` don't carry every field
 * `TeamClient`/`TeamMeeting` require (e.g. `deadline`, `custType`,
 * `meetingMode`) so they don't structurally satisfy those signatures.
 */
export function computeExecClientProgress(client: ExecClient, meetings: ExecMeeting[]): number {
  const presented = meetings.some((m) => m.clientId === client.id && m.agenda.includes(PRESENTATION_AGENDA));
  return presented ? 100 : 0;
}

export async function fetchExecutiveOverview(): Promise<ExecutiveOverview> {
  const profiles = await fetchAllProfiles();
  const managerProfiles = profiles.filter((p) => p.role === MANAGER_ROLE);
  const agentProfiles = profiles.filter((p) => (AGENT_ROLES as readonly string[]).includes(p.role));

  const { clients: allClients, meetings } = await fetchAllClientsAndMeetings();
  const lostClients = allClients.filter((c) => c.status === 'lost');
  const activeClients = allClients.filter((c) => !EXCLUDED_CLIENT_STATUSES.has(c.status) && c.status !== 'lost');

  const now = new Date();
  const managerIdByTeamId = buildManagerIdByTeamId(managerProfiles);
  const teamIdByAgentId = new Map(agentProfiles.map((p) => [p.id, p.team_id]));

  const thisMonthMeetings = meetings.filter((m) => isSameMonth(m.meeting_date, now));

  return {
    managers: buildExecManagers(managerProfiles, agentProfiles, activeClients, meetings),
    agents: buildExecAgents(agentProfiles, activeClients, meetings, managerIdByTeamId, now),
    clients: buildExecClients(activeClients, teamIdByAgentId, managerIdByTeamId, now),
    meetings: buildExecMeetings(meetings, buildCompanyNameByClientId(allClients)),
    totals: {
      prospects: activeClients.filter((c) => fromRemoteStatus(c.status, c.customer_type) === 'prospect').length,
      clients: activeClients.filter((c) => {
        const status = fromRemoteStatus(c.status, c.customer_type);
        return status === 'new' || status === 'existing';
      }).length,
      meetingsThisMonth: thisMonthMeetings.length,
      successfulThisMonth: thisMonthMeetings.filter((m) => m.outcome === 'successful').length,
      lostCompanyWide: lostClients.length,
      agents: agentProfiles.length,
    },
  };
}
