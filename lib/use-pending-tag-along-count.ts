import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getIncomingCompanionRequests } from './tag-along-invitee-service';
import { subscribeSyncComplete } from './sync/sync-events';
import { describeLoadError } from './error-message';

export interface UsePendingTagAlongCount {
  count: number;
  reload: () => Promise<void>;
}

/**
 * Manager Home's pending-incoming-Tag-Along count (F-205's "needs my
 * action" queue — `app/(manager)/index.tsx`'s `pendingTagAlongCount`,
 * folded into the Approvals quick-action badge alongside
 * `use-manager-approval-feed.ts`'s count). Extracted out of `index.tsx`
 * (2026-08-16 bugfix) so the same focus/mount/sync-complete refresh +
 * stale-response sequencing guard `use-manager-request-feed.ts` and
 * `use-manager-approval-feed.ts` use can be shared without growing
 * `index.tsx` past the 300-line guideline. Before this fix the count only
 * refreshed on `useFocusEffect`, so a Tag-Along that synced down while the
 * Manager stayed on Home (or any other screen) left the badge stale until
 * the next screen focus.
 */
export function usePendingTagAlongCount(profileId: string | null): UsePendingTagAlongCount {
  const [count, setCount] = useState(0);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!profileId) {
      requestSeq.current += 1;
      setCount(0);
      return;
    }
    const seq = ++requestSeq.current;
    try {
      const requests = await getIncomingCompanionRequests(profileId);
      if (seq !== requestSeq.current) return;
      setCount(requests.filter((r) => r.status === 'pending').length);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('[use-pending-tag-along-count] load failed:', describeLoadError(err));
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => subscribeSyncComplete(load), [load]);

  return { count, reload: load };
}
