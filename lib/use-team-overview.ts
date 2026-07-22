import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchTeamOverview, type TeamOverview } from './manager-team-service';
import { useSession } from './session-store';

export interface UseTeamOverview {
  overview: TeamOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * B-054 Phase 1: real Manager team-wide data — see `lib/manager-team-service.ts`.
 * Unlike `lib/useManagerDashboard.ts` (which never surfaces a load failure to
 * the UI, a known gap), this hook has a real `error` state so screens can
 * show a retry affordance instead of spinning forever.
 */
export function useTeamOverview(): UseTeamOverview {
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
      const data = await fetchTeamOverview(teamId, profileId);
      setOverview(data);
    } catch (err) {
      console.error('[use-team-overview] load failed:', err instanceof Error ? err.message : String(err));
      setError('Hindi na-load ang team data. Subukan ulit.');
    } finally {
      setLoading(false);
    }
  }, [teamId, profileId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refreshes on return to this screen — e.g. after a reassignment or a
  // manager-created client (ADR-020), same reasoning as useManagerDashboard.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { overview, loading, error, reload: load };
}
