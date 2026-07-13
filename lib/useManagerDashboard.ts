import { useEffect, useState } from 'react';
import type { ManagerDashboardSummary } from '../types';
import {
  agentById,
  clientById,
  getManagerAgents,
  getManagerApprovals,
  getManagerClients,
  getManagerMeetings,
  getManagerTagAlongRequests,
  managerProfile,
} from './manager-data';
import { MANAGER_OUTCOME_LABELS } from '../types';

/**
 * Placeholder — derives the dashboard summary from the active track's mock
 * dataset (Sales: Erika · RSR: Rommel, ADR-014). No manager aggregate tables
 * exist in Supabase yet (see Database.md); swap the body for real queries once
 * that backend work is scoped (post F-013 UI).
 */
function buildMockSummary(): ManagerDashboardSummary {
  const agents = getManagerAgents();
  const clients = getManagerClients();
  const meetings = getManagerMeetings();
  return {
    managerName: managerProfile().firstName,
    teamProspects: clients.filter((c) => c.status === 'prospect').length,
    teamClients: agents.reduce((sum, a) => sum + a.activeClients, 0),
    teamMeetings: agents.reduce((sum, a) => sum + a.meetingsThisMonth, 0),
    teamMeetingsSuccessful: meetings.filter((m) => m.outcome === 'success').length,
    agentCount: agents.length,
    pendingApprovals: getManagerApprovals().length,
    pendingSyncRecords: meetings.filter((m) => !m.synced).length,
    deadlineWarningCount: clients.filter((c) => c.deadlineWarn).length,
    pendingTagAlongRequests: getManagerTagAlongRequests().length,
    agents,
    recentMeetings: meetings.filter((m) => m.outcome).slice(0, 3).map((m) => ({
      id: m.id,
      clientName: clientById(m.clientId)?.name ?? 'Unknown client',
      agentName: agentById(m.agentId)?.name ?? 'Unknown agent',
      agentInitials: agentById(m.agentId)?.initials ?? '—',
      date: m.date,
      time: m.time,
      outcome: MANAGER_OUTCOME_LABELS[m.outcome!],
    })),
  };
}

export function useManagerDashboard() {
  const [summary, setSummary] = useState<ManagerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSummary(buildMockSummary());
    setLoading(false);
  }, []);

  return { summary, loading };
}
