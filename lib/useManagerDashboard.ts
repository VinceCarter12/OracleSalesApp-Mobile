import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { ManagerDashboardSummary } from '../types';
import { managerProfile } from './manager-data';
import { fetchManagerDashboard } from './manager-dashboard-service';
import { useSession } from './session-store';

/**
 * Real cross-agent Supabase queries (2026-07-16) — see
 * lib/manager-dashboard-service.ts for the full query + RLS-policy detail
 * and its documented gaps (approvals/tag-along have no backing table yet;
 * pendingSyncRecords and deadlineWarningCount are left at 0, not guessed).
 * Previously 100% mock data (`buildMockSummary`, still in git history) —
 * confirmed via Sprint.md 2026-07-16 note that this was the actual source of
 * the "7 prospects is fake data" report, not the agent Home screen.
 */
export function useManagerDashboard() {
  const { teamId } = useSession();
  const [summary, setSummary] = useState<ManagerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!teamId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchManagerDashboard(teamId, managerProfile().firstName);
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refreshes on return to this screen — e.g. after a manager creates a
  // client (ADR-020) so the new count shows up without a restart.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { summary, loading };
}
