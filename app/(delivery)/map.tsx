import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StoreLocationsMapScreen } from '../../components/maps/StoreLocationsMapScreen';
import { useDeliveryPos } from '../../lib/use-collection-delivery';
import { isScheduledForToday } from '../../lib/collection-delivery-data';
import { initialsFromCompany } from '../../lib/local-collection-delivery-mapper';
import type { MapStoreInput } from '../../lib/use-store-location-map';

// Store Locations (C&D maps, 2026-08-17): the driver's map of today's POs. Thin
// wrapper — the shared StoreLocationsMapScreen does the plotting; this file just
// supplies the delivery data source and the role's navigation targets.
export default function DeliveryMapScreen() {
  const { pos, loading, refresh } = useDeliveryPos();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const today: MapStoreInput[] = pos
    .filter((p) => isScheduledForToday(p.scheduledFor))
    .map((p) => ({ id: p.id, clientId: p.clientId, name: p.client, area: p.area, initials: initialsFromCompany(p.client), gpsLat: p.gpsLat, gpsLng: p.gpsLng, clientLat: p.clientLat, clientLng: p.clientLng }));

  return (
    <StoreLocationsMapScreen
      title="Store Map"
      backHref="/(delivery)"
      stores={today}
      loading={loading}
      onOpenStore={(id) => router.push({ pathname: '/(delivery)/deliver', params: { id } })}
      onSetLocation={(s) =>
        router.push({ pathname: '/(delivery)/set-location', params: { clientId: s.clientId ?? '', name: s.name, back: '/(delivery)/map' } })
      }
    />
  );
}
