import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getNotificationFeedItems } from './notification-feed-service';
import { getReadNotificationIds } from './notification-unread';

/**
 * Notifications-Page-Handoff-2026-08-08, Task 1: drives the dashboard bell
 * dot and the More-tile "Notifications" badge from the same unread model
 * the Notifications screen itself uses (`lib/notification-unread.ts`),
 * instead of the raw outbox-sync count these two badges showed previously.
 * Refetches on every focus of the host screen (mirrors this codebase's
 * existing badge-count hooks, e.g. `lib/use-my-request-statuses.ts`) so a
 * read/unread change made on the Notifications screen is reflected the next
 * time Home or the More tab regains focus.
 */
export function useUnreadNotificationCount(profileId: string | null): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!profileId) {
      setCount(0);
      return;
    }
    Promise.all([getNotificationFeedItems(profileId), getReadNotificationIds()])
      .then(([items, readIds]) => {
        setCount(items.filter((item) => !readIds.has(item.id)).length);
      })
      .catch((err) => {
        console.error('[use-unread-notification-count] refresh failed:', err instanceof Error ? err.message : String(err));
        setCount(0);
      });
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return count;
}
