import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchTeamOverview, type TeamOverview } from './manager-team-service';
import { DEFAULT_MANAGER_SCOPE, type ManagerScope } from './manager-scope';
import { useSession } from './session-store';
import { describeLoadError } from './error-message';

export interface UseTeamOverview {
  overview: TeamOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * B-054 Phase 1: real Manager team-wide data — see `lib/manager-team-service.ts`.
 * Has a real `error` state so screens can show a retry affordance instead of
 * spinning forever.
 *
 * `scope` (B-073, ADR-052 §G) defaults to `DEFAULT_MANAGER_SCOPE` ('combined')
 * — this reproduces `fetchTeamOverview()`'s pre-existing always-include-the-
 * manager behavior exactly, so every caller besides Manager Home/Manager
 * Meetings (Manager Clients, Manager Team, Reports, reassign, …) is
 * unaffected by this change.
 */
export function useTeamOverview(scope: ManagerScope = DEFAULT_MANAGER_SCOPE): UseTeamOverview {
  const { teamId, profileId } = useSession();
  const [overview, setOverview] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId || !profileId) {
      setOverview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamOverview(teamId, profileId, scope);
      setOverview(data);
    } catch (err) {
      console.error('[use-team-overview] load failed:', describeLoadError(err));
      setError("Team data couldn't be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [teamId, profileId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  // Refreshes on return to this screen — e.g. after a reassignment or a
  // manager-created client (ADR-020), same reasoning as useManagerDashboard.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { overview, loading, error, reload: load };
}
