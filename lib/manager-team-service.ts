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
import { DEFAULT_MANAGER_SCOPE, partitionByScope, type ManagerScope } from './manager-scope';
import { fetchAcceptedTagAlongMeetingContext } from './manager-tag-along-meetings';
import { fetchHeldClientContext } from './manager-held-clients';
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
  /**
   * Guest Records scope (2026-08-22): held clients/meetings from OTHER
   * teams, populated only when `scope === 'guest' || scope === 'combined'`
   * (mirrors B-131's existing `tagAlongMeetingViews` combined-only
   * condition above). Deliberately SEPARATE, ADDITIVE fields — never merged
   * into `clients`/`meetings` directly, so Team roster/Reports/reassign
   * can't accidentally pick them up without an explicit, conscious read of
   * these two fields.
   */
  guestClients: TeamClient[];
  guestMeetings: TeamMeeting[];
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

  // Explicit ordering matters here, not just cosmetics: with none, Postgres
  // returns rows in an unspecified (effectively physical/insertion-scan)
  // order that can put a just-added record anywhere in the list — on the
  // Manager Meetings/Clients screens (neither of which re-sorts client-side)
  // that read as "the newest one didn't show up" when it had, just buried
  // mid-list. Newest-first matches what both screens' rows visually promise.
  const [{ data: clientRows, error: clientError }, { data: meetingRows, error: meetingError }] = await Promise.all([
    supabase
      .from('clients')
      .select(
        'id, company_name, contact_person, contact_number, office_address, customer_type, sales_channel, status, assigned_agent_id, details_deadline_at, created_at'
      )
      .in('assigned_agent_id', agentIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('meetings')
      .select(
        'id, client_id, agent_id, meeting_type, location_type, location_name, gps_lat, gps_lng, end_gps_lat, end_gps_lng, photo_url, start_photo_url, end_photo_url, agenda, remarks, outcome, contact_person, contact_position, meeting_date, start_captured_at, end_captured_at, created_at, client_status_at_meeting'
      )
      .in('agent_id', agentIds)
      .order('meeting_date', { ascending: false }),
  ]);
  if (clientError) throw clientError;
  if (meetingError) throw meetingError;

  return {
    clients: (clientRows ?? []) as ClientRow[],
    meetings: (meetingRows ?? []) as MeetingRow[],
  };
}

// B-131 fix: a manager's own ACCEPTED meeting-context Tag-Along
// participation in ANOTHER team's meeting is otherwise invisible to
// `fetchTeamOverview()` — `fetchClientsAndMeetings()` above only ever
// queries this team's roster. Deliberately NOT merged into
// `allClients`/`profiles`/the returned `agents` array — Manager Team ("My
// Team" roster) and Reports both read `agents` as "my own team's staff",
// and a cross-team agent doesn't belong there. Name resolution instead
// travels on the injected `TeamMeeting` rows themselves
// (`tagAlongOwnerAgentName`/`tagAlongOwnerClientName`).
async function buildTagAlongGuestMeetingViews(
  managerProfileId: string,
  excludeMeetingIds: ReadonlySet<string>
): Promise<TeamMeeting[]> {
  const { meetings, agentsById, clientsById } = await fetchAcceptedTagAlongMeetingContext(
    managerProfileId,
    excludeMeetingIds
  );
  return meetings.map((m) => {
    const clientRow = m.client_id ? clientsById.get(m.client_id) : undefined;
    const status = clientRow ? fromRemoteStatus(clientRow.status, clientRow.customer_type) : undefined;
    return {
      ...mapMeetingRowToTeamMeeting(m, status ? clientStatusLabel(status) : '—'),
      isTagAlongGuestRecord: true,
      tagAlongOwnerAgentName: agentsById.get(m.agent_id)?.full_name,
      tagAlongOwnerClientName: clientRow?.company_name,
    };
  });
}

// Guest Records scope (2026-08-22): a held client's full record + full
// meeting history — broader than `buildTagAlongGuestMeetingViews()` above
// (which only ever adds the specific meeting(s) the manager was personally
// invited to). Deliberately returned as separate `guestClients`/
// `guestMeetings` arrays (`TeamOverview`'s own doc comment) rather than
// merged into `allClients`/`allMeetings` — those feed `agents`/roster math
// this data must never influence.
async function buildGuestClientAndMeetingViews(
  managerProfileId: string,
  now: Date,
  excludeMeetingIds: ReadonlySet<string>,
  excludeClientIds: ReadonlySet<string>
): Promise<{ guestClients: TeamClient[]; guestMeetings: TeamMeeting[] }> {
  const { clients, meetings, agentsById } = await fetchHeldClientContext(
    managerProfileId,
    excludeMeetingIds,
    excludeClientIds
  );
  const guestClients: TeamClient[] = clients.map((c) => ({
    ...mapClientRowToTeamClient(c, now),
    isGuestRecord: true,
    guestOwnerAgentName: agentsById.get(c.assigned_agent_id)?.full_name,
  }));
  const clientStatusById = new Map(clients.map((c) => [c.id, fromRemoteStatus(c.status, c.customer_type)]));
  const guestMeetings: TeamMeeting[] = meetings.map((m) => {
    const status = m.client_id ? clientStatusById.get(m.client_id) : undefined;
    return {
      ...mapMeetingRowToTeamMeeting(m, status ? clientStatusLabel(status) : '—'),
      isGuestRecord: true,
      guestOwnerAgentName: agentsById.get(m.agent_id)?.full_name,
    };
  });
  return { guestClients, guestMeetings };
}

function buildOwnTeamMeetingViews(meetings: readonly MeetingRow[], clientStatusById: Map<string, ReturnType<typeof fromRemoteStatus>>): TeamMeeting[] {
  return meetings.map((m) => {
    const status = m.client_id ? clientStatusById.get(m.client_id) : undefined;
    return mapMeetingRowToTeamMeeting(m, status ? clientStatusLabel(status) : '—');
  });
}

/**
 * `teamId`/`managerProfileId` come from `useSession()` — RLS scopes what
 * actually comes back (B-047's broad-read profiles policy + the Migration
 * 016 clients/meetings agent-scoped policies), this query just asks for the
 * manager's own team plus their own profile id.
 *
 * `scope` (B-073, ADR-052 §G) defaults to `DEFAULT_MANAGER_SCOPE` ('combined')
 * — this function already always fetched the manager's own records alongside
 * the team's, so an unpassed `scope` reproduces this function's exact
 * pre-existing behavior. Every caller of `useTeamOverview()` other than
 * Manager Home/Manager Meetings (Manager Clients, Manager Team, Reports,
 * Account, tag-along reassign, …) doesn't pass a scope and is therefore
 * unaffected by this change.
 */
export async function fetchTeamOverview(
  teamId: string,
  managerProfileId: string,
  scope: ManagerScope = DEFAULT_MANAGER_SCOPE
): Promise<TeamOverview> {
  const profiles = await fetchTeamProfiles(teamId);
  // ADR-020: a manager can create clients directly (assigned to their own
  // profileId) — included in the clients/meetings query so those clients
  // don't vanish from "team clients", but NOT in `profiles`/`buildTeamAgents`
  // (the manager isn't a roster entry on their own team screen).
  const agentIds = [...profiles.map((p) => p.id), managerProfileId];

  const { clients: allTeamClients, meetings: allMeetings } = await fetchClientsAndMeetings(agentIds);
  // Lost/deleted clients are Executive/reports territory, not this list.
  const allClients = allTeamClients.filter((c) => !EXCLUDED_CLIENT_STATUSES.has(c.status));
  // B-073 fix: partition by scope AFTER fetching the combined set, same
  // derivation `lib/manager-dashboard-service.ts` now uses — the two used to
  // disagree (this function always included the manager, the dashboard
  // service always excluded them); `partitionByScope` is the one shared
  // answer both use now.
  const clients = partitionByScope(allClients, (c) => c.assigned_agent_id, managerProfileId, scope);
  const meetings = partitionByScope(allMeetings, (m) => m.agent_id, managerProfileId, scope);

  const now = new Date();
  // Built from the full (unpartitioned) client set — a meeting's `agent_id`
  // (who ran it) and its client's `assigned_agent_id` (who owns it) can
  // legitimately differ (reassignment, tag-along), so status/label lookups
  // must not depend on the scope partition.
  const clientStatusById = new Map(allClients.map((c) => [c.id, fromRemoteStatus(c.status, c.customer_type)]));

  const weekAgo = new Date(now.getTime() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const prospectClients = clients.filter((c) => clientStatusById.get(c.id) === 'prospect');
  const nonProspectClients = clients.filter((c) => {
    const status = clientStatusById.get(c.id);
    return status === 'new' || status === 'existing';
  });

  // Only 'combined' (the default) adds tag-along-accepted meetings — mirrors
  // `lib/manager-attendance-history-service.ts::getManagerAttendanceHistory()`'s
  // exact scope semantics: 'mine' means agent_id-owned only (a tag-along
  // guest attendance isn't "mine"), 'team' means the team roster only.
  const tagAlongMeetingViews = scope === 'combined'
    ? await buildTagAlongGuestMeetingViews(managerProfileId, new Set(allMeetings.map((m) => m.id)))
    : [];

  // Guest Records scope (2026-08-22): same combined-only-style gate as
  // `tagAlongMeetingViews` above, widened to also fire for the new 'guest'
  // scope value — the only two scopes that ever need held-client data.
  //
  // B-132 fix: exclude every meeting ID already surfaced via the own-team
  // query (`allMeetings`) or via B-131's tag-along path (`tagAlongMeetingViews`,
  // '[]' when scope !== 'combined') — a held client's full meeting history
  // otherwise re-includes the exact meeting that granted holder status,
  // producing a duplicate React key. `allClients`' IDs are excluded the same
  // way in case a held client is later reassigned onto the manager's own
  // team roster.
  const excludeGuestMeetingIds = new Set([
    ...allMeetings.map((m) => m.id),
    ...tagAlongMeetingViews.map((m) => m.id),
  ]);
  const excludeGuestClientIds = new Set(allClients.map((c) => c.id));
  const { guestClients, guestMeetings } = scope === 'guest' || scope === 'combined'
    ? await buildGuestClientAndMeetingViews(managerProfileId, now, excludeGuestMeetingIds, excludeGuestClientIds)
    : { guestClients: [], guestMeetings: [] };

  return {
    // Deliberately built from the FULL (unpartitioned) roster data — see
    // the matching comment in lib/manager-dashboard-service.ts.
    agents: buildTeamAgents(profiles, allClients, allMeetings, now),
    clients: clients.map((c) => mapClientRowToTeamClient(c, now)),
    meetings: [...buildOwnTeamMeetingViews(meetings, clientStatusById), ...tagAlongMeetingViews],
    newProspectsThisWeek: countCreatedSince(prospectClients, weekAgo),
    newTeamClientsThisWeek: countCreatedSince(nonProspectClients, weekAgo),
    guestClients,
    guestMeetings,
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
