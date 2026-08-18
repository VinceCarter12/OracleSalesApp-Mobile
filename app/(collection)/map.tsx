import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StoreLocationsMapScreen } from '../../components/maps/StoreLocationsMapScreen';
import { useCollectionStores } from '../../lib/use-collection-delivery';
import { isScheduledForToday } from '../../lib/collection-delivery-data';
import type { MapStoreInput } from '../../lib/use-store-location-map';

// Store Locations (C&D maps, 2026-08-17): the collector's map of today's stores.
// Thin wrapper — the shared StoreLocationsMapScreen does the plotting; this file
// just supplies the collection data source and the role's navigation targets.
export default function CollectionMapScreen() {
  const { stores, loading, refresh } = useCollectionStores();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const today: MapStoreInput[] = stores
    .filter((s) => isScheduledForToday(s.scheduledFor))
    .map((s) => ({ id: s.id, clientId: s.clientId, name: s.name, area: s.area, initials: s.initials, gpsLat: s.gpsLat, gpsLng: s.gpsLng }));

  return (
    <StoreLocationsMapScreen
      title="Store Map"
      backHref="/(collection)"
      stores={today}
      loading={loading}
      onOpenStore={(id) => router.push({ pathname: '/(collection)/visit', params: { id } })}
      onSetLocation={(s) =>
        router.push({ pathname: '/(collection)/set-location', params: { clientId: s.clientId ?? '', name: s.name, back: '/(collection)/map' } })
      }
    />
  );
}
