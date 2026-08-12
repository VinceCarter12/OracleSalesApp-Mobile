import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchMyRequestStatuses, type MyRequestRow } from './my-request-status-service';

export interface UseMyRequestStatuses {
  rows: MyRequestRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Batch 8: mirrors `lib/use-manager-approval-feed.ts`'s loading/error/focus-refresh shape for the Sales/RSR My Requests screen. */
export function useMyRequestStatuses(): UseMyRequestStatuses {
  const [rows, setRows] = useState<MyRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyRequestStatuses();
      setRows(data);
    } catch (err) {
      console.error('[use-my-request-statuses] load failed:', err instanceof Error ? err.message : String(err));
      setError("Your requests couldn't be loaded. Try again.");
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
