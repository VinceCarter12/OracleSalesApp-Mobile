import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getManagerNotificationFeedItems, type ManagerNotificationFeedItem } from './manager-notification-feed-service';
import { getReadNotificationIds } from './notification-unread';
import { subscribeSyncComplete } from './sync/sync-events';
import { describeLoadError } from './error-message';

/**
 * Shared read model for the Manager Home bell badge (requirement C) and the
 * foreground "new requests" popup (requirement D) — both need the same
 * "still pending, needs a decision" subset of `client_edit` +
 * `po_confirmation` + `tag_along`, so this hook is the single place that
 * derives it from `getManagerNotificationFeedItems()` (which already merges
 * all three via `pending: boolean`, 2026-08-16) plus the local read-state
 * (`lib/notification-unread.ts`). Refreshes on focus and on every
 * sync-complete event so a Tag-Along that just synced down updates the badge
 * without a restart, same as `useManagerRequestFeed()`.
 */
export interface UseManagerActionableRequests {
  /** Every currently-pending client_edit/po_confirmation/tag_along item. */
  pendingItems: ManagerNotificationFeedItem[];
  /** Subset of `pendingItems` this device has not marked read yet. */
  unreadPendingItems: ManagerNotificationFeedItem[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

function isActionableCategory(category: ManagerNotificationFeedItem['category']): boolean {
  return category === 'approvals' || category === 'tag_along';
}

export function useManagerActionableRequests(profileId: string | null): UseManagerActionableRequests {
  const [pendingItems, setPendingItems] = useState<ManagerNotificationFeedItem[]>([]);
  const [unreadPendingItems, setUnreadPendingItems] = useState<ManagerNotificationFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // See use-manager-request-feed.ts: focus/mount/sync-complete can dispatch
  // overlapping load() calls, so a stale resolution must not overwrite a
  // fresher one.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!profileId) {
      requestSeq.current += 1;
      setPendingItems([]);
      setUnreadPendingItems([]);
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const [items, readIds] = await Promise.all([getManagerNotificationFeedItems(profileId), getReadNotificationIds()]);
      if (seq !== requestSeq.current) return;
      const pending = items.filter((item) => isActionableCategory(item.category) && item.pending);
      setPendingItems(pending);
      setUnreadPendingItems(pending.filter((item) => !readIds.has(item.id)));
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('[use-manager-actionable-requests] load failed:', describeLoadError(err));
      setError("Pending requests couldn't be loaded. Try again.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => subscribeSyncComplete(load), [load]);

  return { pendingItems, unreadPendingItems, loading, error, reload: load };
}
