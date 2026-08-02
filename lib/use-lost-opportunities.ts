import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from './session-store';
import {
  fetchClaimableLostOpportunities,
  fetchLastMeetingSummary,
  type LostOpportunityListItem,
} from './lost-opportunity-list-service';

export interface UseLostOpportunities {
  items: LostOpportunityListItem[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Batch 9 Step C: list data for `app/(tabs)/more/lost-opportunities/index.tsx`
 * — mirrors `lib/use-executive-lost-opportunities.ts`'s loading/error/
 * focus-refresh shape (online-required, no local cache, refetch on every
 * return to the screen so a row claimed elsewhere disappears).
 */
export function useLostOpportunities(): UseLostOpportunities {
  const { profileId } = useSession();
  const [items, setItems] = useState<LostOpportunityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClaimableLostOpportunities(profileId);
      setItems(data);
    } catch (err) {
      console.error('[use-lost-opportunities] load failed:', err instanceof Error ? err.message : String(err));
      setError('Hindi na-load ang listahan ng lost opportunities. Subukan ulit.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { items, loading, error, reload: load };
}

export interface LostOpportunityDetailData extends LostOpportunityListItem {
  lastMeetingAt: string | null;
  lastMeetingSummary: string | null;
}

export interface UseLostOpportunityDetail {
  item: LostOpportunityDetailData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Single-item fetch for `app/(tabs)/more/lost-opportunities/[id].tsx`.
 * Deliberately re-runs the SAME claimable-list query as the list screen
 * (rather than a second, parallel "fetch one client by id" implementation)
 * so the historical-former-owner exclusion is never duplicated/out of sync
 * between the two screens — if the id isn't in that list anymore (claimed
 * elsewhere, cooldown re-applied, etc.), `item` comes back `null` and the
 * screen shows "no longer available," same defensive-re-check reasoning as
 * the service file's own comment.
 */
export function useLostOpportunityDetail(clientId: string | undefined): UseLostOpportunityDetail {
  const { profileId } = useSession();
  const [item, setItem] = useState<LostOpportunityDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId || !clientId) {
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, lastMeeting] = await Promise.all([
        fetchClaimableLostOpportunities(profileId),
        fetchLastMeetingSummary(clientId),
      ]);
      const found = list.find((row) => row.id === clientId) ?? null;
      setItem(
        found
          ? {
              ...found,
              lastMeetingAt: lastMeeting?.meetingDate ?? null,
              lastMeetingSummary: lastMeeting?.summary ?? null,
            }
          : null
      );
    } catch (err) {
      console.error('[use-lost-opportunities] detail load failed:', err instanceof Error ? err.message : String(err));
      setError('Hindi na-load ang detalye ng opportunity. Subukan ulit.');
    } finally {
      setLoading(false);
    }
  }, [profileId, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { item, loading, error, reload: load };
}
