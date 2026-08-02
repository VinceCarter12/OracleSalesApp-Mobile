import { supabase } from './supabase';
import { fromRemoteOutcome } from './remote-meeting-mapping';
import { buildTeamAgents, initialsOf } from './team-remote-mappers';
import { DEFAULT_MANAGER_SCOPE, partitionByScope, type ManagerScope } from './manager-scope';
import type { ManagerDashboardSummary, TeamMeetingPreview } from '../types';

// Real cross-agent Supabase queries for the Manager dashboard (2026-07-16,
// see Sprint.md's 2026-07-16 note) — replaces lib/useManagerDashboard.ts's
// mock summary. A manager's own device only mirrors THEIR OWN local SQLite
// data (ADR-001), never other agents' — team-wide numbers can only come from
// a live Supabase query, unlike the agent-side screens which read local-first.
//
// Requires two RLS policies that didn't exist before this (see
// Supabase-Changes-2026-07-16-Meetings-RLS-Storage.md item 6):
//   create policy "Authenticated read profiles" on public.profiles for select using (auth.role() = 'authenticated');
//   create policy "Authenticated read meetings" on public.meetings for select using (auth.role() = 'authenticated');
// (clients already got a broad authenticated-read policy earlier today, B-009.)
//
// NOT wired to real data (no backing table exists remotely at all):
// pendingTagAlongRequests — kept as an unused-by-Home-screen field (F-205
// moved the real pending-tag-along count to a direct
// `getIncomingCompanionRequests()` read in app/(manager)/index.tsx instead).
// pendingSyncRecords is also left at 0 — a manager's own outbox only
// reflects their own device's pending writes, not the team's (each agent's
// device syncs itself), so there's no single real number to show here yet
// either. `pendingApprovals` was removed entirely (F-205 — the Approvals
// concept no longer exists).
// deadlineWarningCount is left at 0 — the prospect-lifecycle columns
// (details_deadline_at etc., ADR-006) were never confirmed present on the
// live `clients` table (only the columns actually queried below have been
// confirmed via information_schema.columns); guessing at an unconfirmed
// column name today already caused several bugs (B-011), so this is left
// as a known gap rather than repeating that mistake.

interface ProfileRow {
  id: string;
  full_name: string;
}

interface ClientRow {
  id: string;
  company_name: string;
  customer_type: string | null;
  assigned_agent_id: string;
}

interface MeetingRow {
  id: string;
  client_id: string | null;
  agent_id: string;
  outcome: string | null;
  meeting_date: string;
}

function isSameMonth(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return d.getMonth() === reference.getMonth() && d.getFullYear() === reference.getFullYear();
}

export async function fetchManagerDashboard(
  managerTeamId: string,
  managerFirstName: string,
  managerProfileId: string,
  scope: ManagerScope = DEFAULT_MANAGER_SCOPE
): Promise<ManagerDashboardSummary> {
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('team_id', managerTeamId)
    .in('role', ['sales_specialist', 'rsr']);
  const profiles = (profileRows ?? []) as ProfileRow[];
  // `clients.assigned_agent_id` / `meetings.agent_id` are FKs to `profiles.id`,
  // never `profiles.user_id` (ADR-023) — B-055 fix.
  const agentIds = profiles.map((p) => p.id);
  // B-073 fix: always fetch the manager's own clients/meetings alongside the
  // team roster's, then partition by scope client-side (lib/manager-scope.ts)
  // — this file used to hard-exclude the manager entirely, which is exactly
  // the divergence from lib/manager-team-service.ts::fetchTeamOverview() (which
  // always included the manager) that made 'mine'/'team'/'combined'
  // inconsistent across screens.
  const queryAgentIds = Array.from(new Set([...agentIds, managerProfileId]));

  const [{ data: clientRows }, { data: meetingRows }] = queryAgentIds.length
    ? await Promise.all([
        supabase.from('clients').select('id, company_name, customer_type, assigned_agent_id').in('assigned_agent_id', queryAgentIds),
        supabase.from('meetings').select('id, client_id, agent_id, outcome, meeting_date').in('agent_id', queryAgentIds),
      ])
    : [{ data: [] }, { data: [] }];
  const allClients = (clientRows ?? []) as ClientRow[];
  const allMeetings = (meetingRows ?? []) as MeetingRow[];
  const clients = partitionByScope(allClients, (c) => c.assigned_agent_id, managerProfileId, scope);
  const meetings = partitionByScope(allMeetings, (m) => m.agent_id, managerProfileId, scope);

  const now = new Date();
  const thisMonthMeetings = meetings.filter((m) => isSameMonth(m.meeting_date, now));

  // Dedup (B-054 Phase 1): shared with lib/manager-team-service.ts via
  // lib/team-remote-mappers.ts::buildTeamAgents(). B-055 fix: agents are now
  // keyed by `p.id` (profiles.id, ADR-023 canonical ownership identity),
  // matching lib/manager-team-service.ts's already-correct precedent.
  // Deliberately built from the FULL (unpartitioned) roster data, not the
  // scope-filtered `clients`/`meetings` above — "Agents"/"My Team" is a
  // roster-headcount fact, not a scope-selectable record set (the manager
  // themself was never a roster entry here, same as before this fix).
  const agents = buildTeamAgents(profiles, allClients, allMeetings, now);
  // The manager's own name/initials for `recentMeetings` rows attributed to
  // them ('mine'/'combined' scope can surface the manager's own meetings,
  // but `agents` above never includes the manager as a roster entry).
  const managerAsAgent = { id: managerProfileId, name: managerFirstName, initials: initialsOf(managerFirstName) };
  const agentById = new Map([...agents, managerAsAgent].map((a) => [a.id, a]));
  // Built from the full (unpartitioned) client set, not the scope-filtered
  // `clients` above — a meeting's `agent_id` (who ran it) and its client's
  // `assigned_agent_id` (who owns it) can legitimately differ (reassignment,
  // tag-along), so this name lookup must not depend on the scope partition
  // or it could wrongly show "Unknown client" for an in-scope meeting.
  const clientNameById = new Map(allClients.map((c) => [c.id, c.company_name]));

  // Existing-client fast-path meetings have no outcome at all (ADR-015) —
  // filtered out here same as the old mock summary did, rather than
  // inventing a fallback label for something that was never asked.
  const recentMeetings: TeamMeetingPreview[] = [...meetings]
    .filter((m) => m.outcome)
    .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())
    .slice(0, 3)
    .map((m) => {
      const agent = agentById.get(m.agent_id);
      const date = new Date(m.meeting_date);
      return {
        id: m.id,
        clientName: (m.client_id && clientNameById.get(m.client_id)) || 'Unknown client',
        agentName: agent?.name ?? 'Unknown agent',
        agentInitials: agent?.initials ?? '—',
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString(),
        outcome: fromRemoteOutcome(m.outcome) ?? 'No Decision',
      };
    });

  return {
    managerName: managerFirstName,
    teamProspects: clients.filter((c) => c.customer_type === 'prospect').length,
    teamClients: clients.filter((c) => c.customer_type === 'new' || c.customer_type === 'existing').length,
    teamMeetings: thisMonthMeetings.length,
    teamMeetingsSuccessful: thisMonthMeetings.filter((m) => m.outcome === 'successful').length,
    agentCount: agents.length,
    pendingSyncRecords: 0,
    deadlineWarningCount: 0,
    pendingTagAlongRequests: 0,
    agents,
    recentMeetings,
  };
}
