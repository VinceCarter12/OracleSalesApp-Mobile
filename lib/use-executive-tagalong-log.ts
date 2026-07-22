import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchExecutiveTagAlongLog, type ExecTagAlongDecision } from './executive-tagalong-log-service';

export interface UseExecutiveTagAlongLog {
  items: ExecTagAlongDecision[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** B-060: real data for `app/(executive)/more/approvals-log.tsx` (repurposed to Tag-Along decisions) — mirrors lib/use-executive-overview.ts's loading/error/focus-refresh shape. */
export function useExecutiveTagAlongLog(): UseExecutiveTagAlongLog {
  const [items, setItems] = useState<ExecTagAlongDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExecutiveTagAlongLog();
      setItems(data);
    } catch (err) {
      console.error('[use-executive-tagalong-log] load failed:', err instanceof Error ? err.message : String(err));
      setError('Hindi na-load ang tag-along decision history. Subukan ulit.');
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
