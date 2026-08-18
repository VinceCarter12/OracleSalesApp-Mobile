import { useCallback, useEffect, useState } from 'react';
import { subscribeSyncComplete } from './sync/sync-events';
import { listStoreLocations, type StoreLocation } from './store-location-service';

// Store Locations (C&D maps, 2026-08-17): reads a store's numbered location
// list from the local mirror. Mirrors use-collection-delivery.ts — fetch on
// mount + re-fetch on sync-complete so a background pull (once the web table
// lands and these sync down) refreshes without a manual reload. `refresh` is
// also called imperatively right after addStoreLocation/setCurrentStoreLocation
// so the setter sees their own change immediately, offline included.

export function useStoreLocations(clientId: string | undefined) {
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clientId) {
      setLocations([]);
      setLoading(false);
      return;
    }
    setLocations(await listStoreLocations(clientId));
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  const current = locations.find((l) => l.isCurrent) ?? null;

  return { locations, current, loading, refresh: fetch };
}
