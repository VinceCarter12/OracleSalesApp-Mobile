import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchManagerRequestFeed, type ManagerRequestRow } from './manager-request-feed-service';
import { describeLoadError } from './error-message';

export interface UseManagerRequestFeed {
  rows: ManagerRequestRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Combined Manager Requests inbox — mirrors `use-manager-approval-feed.ts`'s loading/error/focus-refresh shape. */
export function useManagerRequestFeed(profileId: string | null): UseManagerRequestFeed {
  const [rows, setRows] = useState<ManagerRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManagerRequestFeed(profileId);
      setRows(data);
    } catch (err) {
      console.error('[use-manager-request-feed] load failed:', describeLoadError(err));
      setError("The requests couldn't be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { rows, loading, error, reload: load };
}
