import { supabase } from './supabase';
import { fromRemoteOutcome } from './remote-meeting-mapping';
import type { ManagerDashboardSummary, TeamAgent, TeamMeetingPreview } from '../types';

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
// pendingApprovals, pendingTagAlongRequests — the approval/tag-along workflow
// has no Supabase table yet, this is a separate, unscoped future feature, not
// a quick query away like the rest of this. pendingSyncRecords is also left
// at 0 — a manager's own outbox only reflects their own device's pending
// writes, not the team's (each agent's device syncs itself), so there's no
// single real number to show here yet either.
// deadlineWarningCount is left at 0 — the prospect-lifecycle columns
// (details_deadline_at etc., ADR-006) were never confirmed present on the
// live `clients` table (only the columns actually queried below have been
// confirmed via information_schema.columns); guessing at an unconfirmed
// column name today already caused several bugs (B-011), so this is left
// as a known gap rather than repeating that mistake.

interface ProfileRow {
  user_id: string;
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

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '—';
}

function isSameMonth(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return d.getMonth() === reference.getMonth() && d.getFullYear() === reference.getFullYear();
}

export async function fetchManagerDashboard(
  managerTeamId: string,
  managerFirstName: string
): Promise<ManagerDashboardSummary> {
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .eq('team_id', managerTeamId)
    .in('role', ['sales_specialist', 'rsr']);
  const profiles = (profileRows ?? []) as ProfileRow[];
  const agentIds = profiles.map((p) => p.user_id);

  const [{ data: clientRows }, { data: meetingRows }] = agentIds.length
    ? await Promise.all([
        supabase.from('clients').select('id, company_name, customer_type, assigned_agent_id').in('assigned_agent_id', agentIds),
        supabase.from('meetings').select('id, client_id, agent_id, outcome, meeting_date').in('agent_id', agentIds),
      ])
    : [{ data: [] }, { data: [] }];
  const clients = (clientRows ?? []) as ClientRow[];
  const meetings = (meetingRows ?? []) as MeetingRow[];

  const now = new Date();
  const thisMonthMeetings = meetings.filter((m) => isSameMonth(m.meeting_date, now));

  const agents: TeamAgent[] = profiles.map((p) => {
    const agentAllMeetings = meetings.filter((m) => m.agent_id === p.user_id);
    const successCount = agentAllMeetings.filter((m) => m.outcome === 'successful').length;
    return {
      id: p.user_id,
      name: p.full_name,
      initials: initialsOf(p.full_name),
      meetingsThisMonth: thisMonthMeetings.filter((m) => m.agent_id === p.user_id).length,
      activeClients: clients.filter((c) => c.assigned_agent_id === p.user_id).length,
      successRate: agentAllMeetings.length ? Math.round((successCount / agentAllMeetings.length) * 100) : 0,
    };
  });
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const clientNameById = new Map(clients.map((c) => [c.id, c.company_name]));

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
    pendingApprovals: 0,
    pendingSyncRecords: 0,
    deadlineWarningCount: 0,
    pendingTagAlongRequests: 0,
    agents,
    recentMeetings,
  };
}
