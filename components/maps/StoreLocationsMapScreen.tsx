import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { MapPin, MapPinOff } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { useAuth } from '../../lib/useAuth';
import { useSession } from '../../lib/session-store';
import { useUserMapMarker } from '../../lib/use-user-map-marker';
import { useStoreLocationMap, type MapStoreInput } from '../../lib/use-store-location-map';
import type { StoreLocationOrigin } from '../../lib/store-location-resolver';
import { isLikelyOnline } from '../../lib/sync/connectivity';
import { BizTopBar } from '../bizlink/BizTopBar';
import { StatusBadge } from '../ui/StatusBadge';
import { Avatar } from '../ui/Avatar';
import { OfflineBanner } from './MapsScreenSections';
import { LeafletWebViewMapWithControls, type LeafletMapMarker, type MapTileType } from './LeafletWebViewMap';

// Store Locations (C&D maps, 2026-08-17): the shared map screen for BOTH the
// collection and delivery roles (owner decision — both get the map + set-location
// UI). Plots every store on the day's list by its resolved location, buckets the
// ones with no coordinate into "location not set", and lets the officer open a
// store or jump to the set-location flow. Kept role-agnostic (parametrized by
// props) so the two route files stay thin — same reuse pattern as the rest of
// the C&D module.

/** Marker/label styling per resolved origin — a field pin outranks an office pin outranks a visit fix. */
const ORIGIN_META: Record<StoreLocationOrigin, { label: string; colorHex: string; badgeBg: string; badgeColor: string }> = {
  field_set: { label: 'Field pin', colorHex: COLORS.ledgeGreen, badgeBg: COLORS.greenSoft, badgeColor: COLORS.ledgeGreen },
  office_pin: { label: 'Office pin', colorHex: COLORS.blue, badgeBg: COLORS.blueSoft, badgeColor: COLORS.blue },
  visit_gps: { label: 'Visit GPS', colorHex: COLORS.orange, badgeBg: COLORS.amberSoft, badgeColor: COLORS.orange },
};

interface StoreLocationsMapScreenProps {
  title: string;
  /** Where the top-bar back button falls back to (the role dashboard). */
  backHref: string;
  stores: MapStoreInput[];
  loading: boolean;
  /** Open the store's visit / PO detail. */
  onOpenStore: (storeId: string) => void;
  /** Jump to the set/add-location flow for a store (only offered when it has a clientId). */
  onSetLocation: (store: MapStoreInput) => void;
}

export function StoreLocationsMapScreen({ title, backHref, stores, loading, onOpenStore, onSetLocation }: StoreLocationsMapScreenProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { fullName } = useSession();
  const [mapType, setMapType] = useState<MapTileType>('light');
  const [online, setOnline] = useState(true);

  const { located, unlocated } = useStoreLocationMap(stores);
  const userMarker = useUserMapMarker(session?.user.id, fullName);

  const checkOnline = useCallback(() => { isLikelyOnline().then(setOnline); }, []);
  useEffect(() => { checkOnline(); }, [checkOnline]);

  const markers = useMemo<LeafletMapMarker[]>(() => {
    const storeMarkers = located.map((s) => ({
      id: `store:${s.id}`,
      lat: s.lat,
      lng: s.lng,
      colorHex: ORIGIN_META[s.origin].colorHex,
      radius: 9,
      label: `${s.name} · ${ORIGIN_META[s.origin].label}`,
      icon: { kind: 'pin' as const, text: s.initials },
    }));
    return userMarker ? [...storeMarkers, userMarker] : storeMarkers;
  }, [located, userMarker]);

  function handleMarkerPress(id: string): void {
    const [kind, recordId] = id.split(':');
    if (kind === 'store') onOpenStore(recordId);
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={title} fallbackHref={backHref as Href} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
        {!online ? <OfflineBanner /> : null}

        <LeafletWebViewMapWithControls
          markers={markers}
          selectedMarkerIds={[]}
          height={320}
          tileType={mapType}
          onTileTypeChange={setMapType}
          onMarkerPress={handleMarkerPress}
        />

        <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand} marginTop="$2.5">
          {located.length} on the map · {unlocated.length} without a location
        </Text>

        {/* Legend — mirrors the marker colors so the three origins are readable. */}
        <XStack gap="$3" marginTop="$2" flexWrap="wrap">
          {(Object.keys(ORIGIN_META) as StoreLocationOrigin[]).map((origin) => (
            <XStack key={origin} alignItems="center" gap="$1.5">
              <View width={10} height={10} borderRadius={5} backgroundColor={ORIGIN_META[origin].colorHex} />
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                {ORIGIN_META[origin].label}
              </Text>
            </XStack>
          ))}
        </XStack>

        {unlocated.length > 0 ? (
          <YStack marginTop="$4" gap="$2">
            <XStack alignItems="center" gap="$2">
              <MapPinOff size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
              <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                Location not set ({unlocated.length})
              </Text>
            </XStack>
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              These stores have no pin yet. Set one when you reach them.
            </Text>
            {unlocated.map((s) => (
              <StoreRow
                key={s.id}
                name={s.name}
                area={s.area}
                initials={s.initials}
                right={
                  s.clientId ? (
                    <SetLocationButton label="Set location" onPress={() => onSetLocation(s)} />
                  ) : (
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>no client</Text>
                  )
                }
                onPress={() => onOpenStore(s.id)}
              />
            ))}
          </YStack>
        ) : null}

        {located.length > 0 ? (
          <YStack marginTop="$4" gap="$2">
            <XStack alignItems="center" gap="$2">
              <MapPin size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
              <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                Stores on the map ({located.length})
              </Text>
            </XStack>
            {located.map((s) => (
              <StoreRow
                key={s.id}
                name={s.name}
                area={s.area}
                initials={s.initials}
                right={
                  <XStack alignItems="center" gap="$2">
                    <StatusBadge label={ORIGIN_META[s.origin].label} background={ORIGIN_META[s.origin].badgeBg} color={ORIGIN_META[s.origin].badgeColor} />
                    {s.clientId ? <SetLocationButton label="Update" onPress={() => onSetLocation(s)} /> : null}
                  </XStack>
                }
                onPress={() => onOpenStore(s.id)}
              />
            ))}
          </YStack>
        ) : null}

        {!loading && located.length === 0 && unlocated.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$4">
            No stores on today’s list.
          </Text>
        ) : null}
      </ScrollView>
    </YStack>
  );
}

function StoreRow({ name, area, initials, right, onPress }: { name: string; area: string; initials: string; right: React.ReactNode; onPress: () => void }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <Pressable onPress={onPress}>
      <XStack alignItems="center" gap="$3" backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14}>
        <Avatar initials={initials} size="sm" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
        <YStack flex={1} gap="$0.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text} numberOfLines={1}>{name}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{area}</Text>
        </YStack>
        {right}
      </XStack>
    </Pressable>
  );
}

function SetLocationButton({ label, onPress }: { label: string; onPress: () => void }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <XStack alignItems="center" gap="$1" backgroundColor={BIZLINK_COLORS.tintA} borderRadius={999} paddingHorizontal={12} paddingVertical={7}>
        <MapPin size={13} color={BIZLINK_COLORS.ink} strokeWidth={2} />
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>{label}</Text>
      </XStack>
    </Pressable>
  );
}
