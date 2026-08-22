import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchClientFieldLocations, type ClientFieldLocation } from './client-field-locations-service';

// Loads a client's field-set relocation pins for the sales/RSR client-detail
// card (§visibility, migration 126). Online read via get_client_locations — a
// sales agent has no local client_locations mirror. Degrades quietly: a missing
// RPC or an offline read leaves an empty set (the card hides), never an error
// banner, so the client screen still reads fine before web ships / off-signal.

export interface ClientFieldLocationsState {
  /** All field pins for the client, seq ASC. */
  locations: ClientFieldLocation[];
  /** The store's current relocation pin (kind='relocation', is_current), if any. */
  current: ClientFieldLocation | null;
  /** Additional-branch entries (separate stores at this client) for admin triage. */
  branches: ClientFieldLocation[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useClientFieldLocations(clientId: string | undefined): ClientFieldLocationsState {
  const [locations, setLocations] = useState<ClientFieldLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!clientId) {
      setLocations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setLocations(await fetchClientFieldLocations(clientId));
    } catch {
      // fetchClientFieldLocations already swallows a missing RPC; anything else
      // (unexpected offline throw) also just yields "no field locations" here.
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const current = useMemo(
    () => locations.find((l) => l.isCurrent && l.kind === 'relocation') ?? null,
    [locations]
  );
  const branches = useMemo(() => locations.filter((l) => l.kind === 'additional_branch'), [locations]);

  return { locations, current, branches, loading, refresh };
}
