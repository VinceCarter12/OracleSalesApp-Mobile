import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchManagerApprovalFeed, type ManagerApprovalFeedRow } from './manager-approval-feed-service';

export interface UseManagerApprovalFeed {
  rows: ManagerApprovalFeedRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Batch 6 PR B: mirrors `lib/use-executive-tagalong-log.ts`'s loading/error/focus-refresh shape for the Manager Approvals inbox. */
export function useManagerApprovalFeed(): UseManagerApprovalFeed {
  const [rows, setRows] = useState<ManagerApprovalFeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManagerApprovalFeed();
      setRows(data);
    } catch (err) {
      console.error('[use-manager-approval-feed] load failed:', err instanceof Error ? err.message : String(err));
      setError('Hindi na-load ang Approvals. Subukan ulit.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { rows, loading, error, reload: load };
}
