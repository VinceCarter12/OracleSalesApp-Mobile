import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from './session-store';
import {
  fetchLastMeetingSummary,
  fetchLostOpportunities,
  type LostOpportunityRecord,
} from './lost-opportunity-read-service';

export interface UseManagerLostOpportunities {
  items: LostOpportunityRecord[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Batch 9 Step D: list data for
 * `app/(manager)/more/lost-opportunities/index.tsx` — Manager's team-wide,
 * read-only mirror of Sales/RSR's claimable list
 * (`lib/use-lost-opportunities.ts`). Unlike that hook, this one shows BOTH
 * available and cooling-down records (Wireframe-Manager-BizLink.html's
 * `s-lost` `all`/`available`/`cooling` chips) — same
 * loading/error/focus-refresh shape.
 */
export function useManagerLostOpportunities(): UseManagerLostOpportunities {
  const { teamId, profileId } = useSession();
  const [items, setItems] = useState<LostOpportunityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId || !profileId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLostOpportunities({ scope: 'team', teamId, managerProfileId: profileId });
      setItems(data);
    } catch (err) {
      console.error('[use-manager-lost-opportunities] load failed:', err instanceof Error ? err.message : String(err));
      setError("The lost opportunities list couldn't be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [teamId, profileId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { items, loading, error, reload: load };
}

export interface ManagerLostOpportunityDetailData extends LostOpportunityRecord {
  lastMeetingAt: string | null;
  lastMeetingSummary: string | null;
}

export interface UseManagerLostOpportunityDetail {
  item: ManagerLostOpportunityDetailData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Single-item fetch for `app/(manager)/more/lost-opportunities/[id].tsx`.
 * Re-runs the SAME team-scoped query as the list screen (rather than a
 * second "fetch one client by id" implementation), matching
 * `lib/use-lost-opportunities.ts::useLostOpportunityDetail`'s reasoning — if
 * the id isn't in the team's lost list anymore, `item` comes back `null`.
 */
export function useManagerLostOpportunityDetail(clientId: string | undefined): UseManagerLostOpportunityDetail {
  const { teamId, profileId } = useSession();
  const [item, setItem] = useState<ManagerLostOpportunityDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId || !profileId || !clientId) {
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, lastMeeting] = await Promise.all([
        fetchLostOpportunities({ scope: 'team', teamId, managerProfileId: profileId }),
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
      console.error('[use-manager-lost-opportunities] detail load failed:', err instanceof Error ? err.message : String(err));
      setError("The opportunity details couldn't be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [teamId, profileId, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { item, loading, error, reload: load };
}
