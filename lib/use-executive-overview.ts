import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchExecutiveOverview, type ExecutiveOverview } from './executive-overview-service';

export interface UseExecutiveOverview {
  overview: ExecutiveOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * B-054 Phase 2: real Executive company-wide data — see
 * lib/executive-overview-service.ts. Company-wide scope needs no session
 * args (unlike lib/use-team-overview.ts's teamId/profileId) — every
 * Executive sees the same unscoped query. Real `error` state, same as
 * use-team-overview.ts, so the screen can show a retry affordance instead of
 * spinning forever.
 */
export function useExecutiveOverview(): UseExecutiveOverview {
  const [overview, setOverview] = useState<ExecutiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExecutiveOverview();
      setOverview(data);
    } catch (err) {
      console.error('[use-executive-overview] load failed:', err instanceof Error ? err.message : String(err));
      setError('Hindi na-load ang company-wide data. Subukan ulit.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { overview, loading, error, reload: load };
}
