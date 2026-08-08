import { useCallback, useState } from 'react';
import { useSession } from './session-store';
import { runSync } from './sync-engine';

/**
 * Pull-to-refresh helper for the field-role screens. Triggers a REAL network
 * sync (`runSync`, the same pass the 30s foreground timer and the Sync Center's
 * "check now" use) so a just-published list is fetched immediately instead of
 * waiting for the next timer tick. The data hooks (use-collection-delivery.ts)
 * already re-read the local mirror on sync-complete, so most callers don't need
 * to refetch themselves — pass `onDone` for a belt-and-braces local re-read.
 *
 * Wire the returned `refreshing`/`onRefresh` into a <ScrollView>'s
 * <RefreshControl>. A failed sync is swallowed here (connectivity + last-sync
 * detail live in the Sync Center) so the pull gesture never crashes the screen.
 */
export function useSyncRefresh(onDone?: () => void) {
  const { profileId, teamId } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!profileId || refreshing) return;
    setRefreshing(true);
    try {
      await runSync(profileId, teamId);
    } catch {
      // A manual refresh that can't reach the server shouldn't surface an error
      // here — the spinner just stops and the Sync Center shows why.
    } finally {
      setRefreshing(false);
      onDone?.();
    }
  }, [profileId, teamId, refreshing, onDone]);

  return { refreshing, onRefresh };
}
