import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchManagerRequestFeed, type ManagerRequestRow } from './manager-request-feed-service';
import { describeLoadError } from './error-message';
import { subscribeSyncComplete } from './sync/sync-events';
import { checkConnectivity, isOfflineState } from './sync/connectivity';

// 2026-08-16 (Vince): `fetchManagerRequestFeed()` calls
// `fetchManagerApprovalFeed()` -> `getManagerApprovalFeed()`, an online-only
// Supabase RPC with no local SQLite mirror by design (ADR-044 decision 5,
// see `lib/po-confirmation-manager-service.ts`'s doc comment). Vince reported
// this screen going blank with no clear explanation while offline — this
// distinguishes that honest "you're offline" case from a real online failure
// (auth error, server error) instead of one generic error string for both.
export const MANAGER_REQUESTS_OFFLINE_MESSAGE =
  'Approvals and requests need an internet connection to load — connect and try again.';

export interface UseManagerRequestFeed {
  rows: ManagerRequestRow[];
  loading: boolean;
  error: string | null;
  /** True only when `error` is the offline-specific message above — lets the screen render the amber offline notice instead of the generic error box. */
  offline: boolean;
  reload: () => Promise<void>;
}

/** Combined Manager Requests inbox — mirrors `use-manager-approval-feed.ts`'s loading/error/focus-refresh shape. */
export function useManagerRequestFeed(profileId: string | null): UseManagerRequestFeed {
  const [rows, setRows] = useState<ManagerRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  // Focus-refresh, mount, and sync-complete can all call load() close
  // together; an earlier call resolving after a later one must not clobber
  // fresher data. This sequence ref discards any result that isn't from the
  // most-recently-dispatched call.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!profileId) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const data = await fetchManagerRequestFeed(profileId);
      if (seq !== requestSeq.current) return;
      setRows(data);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('[use-manager-request-feed] load failed:', describeLoadError(err));
      const connectivity = await checkConnectivity();
      if (seq !== requestSeq.current) return;
      if (isOfflineState(connectivity)) {
        setError(MANAGER_REQUESTS_OFFLINE_MESSAGE);
        setOffline(true);
      } else {
        setError("The requests couldn't be loaded. Try again.");
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A newly-synced Sales/RSR Tag-Along (or Client Edit/PO Confirmation)
  // request must show up here without the Manager restarting the app or
  // leaving/returning to this screen — mirrors `useMeetings.ts`/
  // `use-manager-attendance-history.ts`'s subscribe-to-sync-complete
  // pattern. `load()` is already stale-response-guarded via `requestSeq`.
  useEffect(() => subscribeSyncComplete(load), [load]);

  return { rows, loading, error, offline, reload: load };
}
