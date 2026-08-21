import { useLocalSearchParams } from 'expo-router';
import { SetStoreLocationScreen } from '../../components/maps/SetStoreLocationScreen';

// Store Locations (C&D maps, 2026-08-17): collector's set/add-location route.
// Thin wrapper around the shared screen; params come from the map's "Set
// location" button (clientId + store name + where back returns to).
export default function CollectionSetLocationScreen() {
  const { clientId, name, registeredArea, back } = useLocalSearchParams<{ clientId?: string; name?: string; registeredArea?: string; back?: string }>();
  return (
    <SetStoreLocationScreen
      clientId={clientId ?? ''}
      clientName={name ?? 'Store'}
      registeredArea={registeredArea || undefined}
      backHref={back ?? '/(collection)/map'}
    />
  );
}
