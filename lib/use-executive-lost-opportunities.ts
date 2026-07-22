import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchExecutiveLostOpportunities, type ExecLostOpportunity } from './executive-lost-opportunity-service';

export interface UseExecutiveLostOpportunities {
  items: ExecLostOpportunity[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** B-060: real data for `app/(executive)/more/lost-opportunity.tsx` — mirrors lib/use-executive-overview.ts's loading/error/focus-refresh shape. */
export function useExecutiveLostOpportunities(): UseExecutiveLostOpportunities {
  const [items, setItems] = useState<ExecLostOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExecutiveLostOpportunities();
      setItems(data);
    } catch (err) {
      console.error('[use-executive-lost-opportunities] load failed:', err instanceof Error ? err.message : String(err));
      setError('Hindi na-load ang lost opportunity list. Subukan ulit.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { items, loading, error, reload: load };
}
