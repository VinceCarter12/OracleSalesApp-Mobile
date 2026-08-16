import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchManagerApprovalFeed, type ManagerApprovalFeedRow } from './manager-approval-feed-service';
import { describeLoadError } from './error-message';
import { subscribeSyncComplete } from './sync/sync-events';

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
  // Same stale-response guard as `use-manager-request-feed.ts`: focus/mount/
  // sync-complete can all dispatch overlapping load() calls, so an
  // earlier-dispatched call resolving after a later one must not clobber
  // fresher data.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManagerApprovalFeed();
      if (seq !== requestSeq.current) return;
      setRows(data);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('[use-manager-approval-feed] load failed:', describeLoadError(err));
      setError("The requests couldn't be loaded. Try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 2026-08-16 bugfix: the Approvals quick-action badge
  // (`pendingApprovalCount + pendingTagAlongCount`) was stuck stale until the
  // next focus/mount — a newly-synced client_edit/po_confirmation must
  // update it the moment the background sync completes, same gap
  // `use-manager-request-feed.ts` already closed.
  useEffect(() => subscribeSyncComplete(load), [load]);

  return { rows, loading, error, reload: load };
}
