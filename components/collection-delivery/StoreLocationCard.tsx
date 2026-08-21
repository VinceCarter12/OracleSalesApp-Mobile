import { useMemo, useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, MapPinOff, X } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { useStoreLocations } from '../../lib/use-store-locations';
import { resolveStoreLocation, type StoreLocationOrigin } from '../../lib/store-location-resolver';
import { formatShortDateTime } from '../../lib/collection-delivery-data';
import { LeafletWebViewMapWithControls, type LeafletMapMarker, type MapTileType } from '../maps/LeafletWebViewMap';

// Store Locations (C&D, 2026-08-20): shows the store's CURRENT known location
// right on the Collect Payment / Deliver PO screens, so the officer sees where
// the store actually is (a field officer may have relocated its pin) the moment
// they open the stop — not just on the day map. Resolves by the same precedence
// as the map (field-set pin → registered/denormalized pin → last visit GPS) and
// reuses the shared WebView map. Kept role-agnostic; the caller wires the
// set/update-location route via `onSetLocation`.

const ORIGIN_META: Record<StoreLocationOrigin, { label: string; colorHex: string; badgeBg: string; badgeColor: string }> = {
  field_set: { label: 'Field pin', colorHex: COLORS.ledgeGreen, badgeBg: COLORS.greenSoft, badgeColor: COLORS.ledgeGreen },
  office_pin: { label: 'Registered pin', colorHex: COLORS.blue, badgeBg: COLORS.blueSoft, badgeColor: COLORS.blue },
  visit_gps: { label: 'Last visit GPS', colorHex: COLORS.orange, badgeBg: COLORS.amberSoft, badgeColor: COLORS.orange },
};

interface StoreLocationCardProps {
  /** Client the store's pins/office coordinate are keyed to; without it only the visit/PO GPS can resolve. */
  clientId?: string;
  /** Marker glyph (store initials); falls back to a generic dot. */
  initials?: string;
  /** Visit/PO-time GPS (weakest tier — only after the stop was worked). */
  gpsLat?: number;
  gpsLng?: number;
  /** Store DEFAULT coordinate denormalized onto the visit/PO row (web 114). */
  clientLat?: number;
  clientLng?: number;
  /** Provided only when the store has a client to attach a pin to — shows the set/update affordance. */
  onSetLocation?: () => void;
}

export function StoreLocationCard({ clientId, initials, gpsLat, gpsLng, clientLat, clientLng, onSetLocation }: StoreLocationCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const [mapType, setMapType] = useState<MapTileType>('light');
  // Tap-to-expand: the inline map lives inside the screen's ScrollView (which
  // fights a pan gesture); the fullscreen modal lets the officer drag/zoom freely
  // to eyeball the exact spot.
  const [expanded, setExpanded] = useState(false);
  // The field-set current pin lives in the local client_locations mirror; the
  // hook re-reads it on sync, so a just-set (or just-synced) pin shows here.
  const { current } = useStoreLocations(clientId || undefined);

  const resolved = useMemo(
    () =>
      resolveStoreLocation({
        currentLocation: current ? { lat: current.lat, lng: current.lng } : undefined,
        officePin: clientLat != null && clientLng != null ? { lat: clientLat, lng: clientLng } : undefined,
        visitGps: gpsLat != null && gpsLng != null ? { lat: gpsLat, lng: gpsLng } : undefined,
      }),
    [current, clientLat, clientLng, gpsLat, gpsLng]
  );

  const markers = useMemo<LeafletMapMarker[]>(
    () =>
      resolved
        ? [{
            id: 'store',
            lat: resolved.lat,
            lng: resolved.lng,
            colorHex: ORIGIN_META[resolved.origin].colorHex,
            radius: 9,
            label: 'Store location',
            icon: { kind: 'pin' as const, text: initials ?? '•' },
          }]
        : [],
    [resolved, initials]
  );

  return (
    <YStack marginTop={12}>
      <XStack alignItems="center" justifyContent="space-between" marginBottom={8}>
        <XStack alignItems="center" gap="$2">
          <MapPin size={15} color={BIZLINK_COLORS.brand} strokeWidth={2} />
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Store location</Text>
        </XStack>
        {resolved ? (
          <View backgroundColor={ORIGIN_META[resolved.origin].badgeBg} borderRadius={999} paddingHorizontal={10} paddingVertical={4}>
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={ORIGIN_META[resolved.origin].badgeColor}>
              {ORIGIN_META[resolved.origin].label}
            </Text>
          </View>
        ) : null}
      </XStack>

      {resolved ? (
        <YStack gap="$2">
          <View borderRadius={20} overflow="hidden">
            <LeafletWebViewMapWithControls
              markers={markers}
              selectedMarkerIds={['store']}
              height={210}
              tileType={mapType}
              onTileTypeChange={setMapType}
              onExpandPress={() => setExpanded(true)}
              onMarkerPress={() => {}}
            />
          </View>

          {/* Fullscreen map — free drag/zoom to see the exact spot without the
              ScrollView stealing the pan. Opens focused on the store pin. */}
          <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
            <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
              <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={16} paddingVertical={12}>
                <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Store location</Text>
                <Pressable onPress={() => setExpanded(false)} hitSlop={10}>
                  <X size={22} color={BIZLINK_COLORS.text} strokeWidth={2} />
                </Pressable>
              </XStack>
              <View flex={1}>
                <LeafletWebViewMapWithControls
                  markers={markers}
                  selectedMarkerIds={['store']}
                  height={0}
                  tileType={mapType}
                  onTileTypeChange={setMapType}
                  expanded
                  onMarkerPress={() => {}}
                />
              </View>
              <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={16} paddingTop={12} paddingBottom={insets.bottom + 12}>
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  {resolved.lat.toFixed(5)}, {resolved.lng.toFixed(5)}
                </Text>
                {onSetLocation ? (
                  <Pressable onPress={() => { setExpanded(false); onSetLocation(); }} hitSlop={6}>
                    <XStack alignItems="center" gap="$1.5" backgroundColor={BIZLINK_COLORS.tintA} borderRadius={999} paddingHorizontal={14} paddingVertical={9}>
                      <MapPin size={14} color={BIZLINK_COLORS.ink} strokeWidth={2} />
                      <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>Update location</Text>
                    </XStack>
                  </Pressable>
                ) : null}
              </XStack>
            </YStack>
          </Modal>

          <XStack alignItems="center" justifyContent="space-between">
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {resolved.lat.toFixed(5)}, {resolved.lng.toFixed(5)}
            </Text>
            {onSetLocation ? (
              <Pressable onPress={onSetLocation} hitSlop={6}>
                <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>Update location</Text>
              </Pressable>
            ) : null}
          </XStack>
          {/* "Relocated — set by X" trust signal: only a field pin carries a
              person + time, and (via the down-sync) it's a COLLEAGUE's pin that
              tells this officer the store moved — the whole point of the feature. */}
          {resolved.origin === 'field_set' && current?.setByName ? (
            <XStack alignItems="center" gap="$1.5">
              <MapPin size={12} color={COLORS.ledgeGreen} strokeWidth={2} />
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                Relocated · set by {current.setByName}
                {current.capturedAt ? ` · ${formatShortDateTime(current.capturedAt)}` : ''}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      ) : (
        <XStack alignItems="center" gap="$2.5" backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14}>
          <MapPinOff size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
          <YStack flex={1} gap="$0.5">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Location not set</Text>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              No pin for this store yet. Set one when you reach it.
            </Text>
          </YStack>
          {onSetLocation ? (
            <Pressable onPress={onSetLocation} hitSlop={6}>
              <XStack alignItems="center" gap="$1" backgroundColor={BIZLINK_COLORS.tintA} borderRadius={999} paddingHorizontal={12} paddingVertical={7}>
                <MapPin size={13} color={BIZLINK_COLORS.ink} strokeWidth={2} />
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>Set location</Text>
              </XStack>
            </Pressable>
          ) : null}
        </XStack>
      )}
    </YStack>
  );
}
