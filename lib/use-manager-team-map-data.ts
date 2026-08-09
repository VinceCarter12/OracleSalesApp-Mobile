import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from './session-store';
import { describeLoadError } from './error-message';
import { fetchTeamMapData, type TeamMapData, type TeamMapDateWindow } from './manager-team-map-service';

export interface UseManagerTeamMapData {
  teamMapData: TeamMapData;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const EMPTY_TEAM_MAP_DATA: TeamMapData = { officePins: [], meetingMarkers: [], teamAgents: [] };

/** Manager Maps "My Team" live data source (ADR-001) — see lib/manager-team-map-service.ts. */
export function useManagerTeamMapData(dateWindow?: TeamMapDateWindow): UseManagerTeamMapData {
  const { teamId } = useSession();
  const startAt = dateWindow?.startAt;
  const endAtExclusive = dateWindow?.endAtExclusive;
  const [teamMapData, setTeamMapData] = useState<TeamMapData>(EMPTY_TEAM_MAP_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamMapData(teamId, { startAt, endAtExclusive });
      setTeamMapData(data);
    } catch (err) {
      console.error('[use-manager-team-map-data] load failed:', describeLoadError(err));
      setError('Hindi na-load ang team map data. Subukan ulit.');
    } finally {
      setLoading(false);
    }
  }, [teamId, startAt, endAtExclusive]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { teamMapData, loading, error, reload: load };
}
