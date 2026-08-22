import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from './session-store';
import { useManagerScope } from './manager-scope-store';
import { describeLoadError } from './error-message';
import { fetchGuestMapData, type GuestMapData } from './manager-guest-map-service';
import type { TeamMapDateWindow } from './manager-team-map-service';

const EMPTY_GUEST_MAP_DATA: GuestMapData = { officePins: [], meetingMarkers: [] };

export interface UseManagerGuestMapData {
  guestMapData: GuestMapData;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Guest Records scope (2026-08-22) — held-client pins/markers for Manager
 * Maps, mirrors `lib/use-manager-team-map-data.ts` but only fetches when
 * the shared scope actually needs it ('guest'/'combined'), same gate
 * `lib/manager-team-service.ts::fetchTeamOverview()` uses for
 * `guestClients`/`guestMeetings`.
 */
export function useManagerGuestMapData(dateWindow?: TeamMapDateWindow): UseManagerGuestMapData {
  const { profileId } = useSession();
  const { scope } = useManagerScope();
  const startAt = dateWindow?.startAt;
  const endAtExclusive = dateWindow?.endAtExclusive;
  const [guestMapData, setGuestMapData] = useState<GuestMapData>(EMPTY_GUEST_MAP_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const needsGuestData = scope === 'guest' || scope === 'combined';

  const load = useCallback(async () => {
    if (!profileId || !needsGuestData) {
      setGuestMapData(EMPTY_GUEST_MAP_DATA);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGuestMapData(profileId, { startAt, endAtExclusive });
      setGuestMapData(data);
    } catch (err) {
      console.error('[use-manager-guest-map-data] load failed:', describeLoadError(err));
      setError("The guest record map data couldn't be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [profileId, needsGuestData, startAt, endAtExclusive]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { guestMapData, loading, error, reload: load };
}
