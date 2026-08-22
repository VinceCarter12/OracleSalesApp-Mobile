import { useMemo, useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, X, Building2 } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { formatShortDateTime } from '../../lib/collection-delivery-data';
import { useClientFieldLocations } from '../../lib/use-client-field-locations';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { LeafletWebViewMapWithControls, type LeafletMapMarker, type MapTileType } from '../maps/LeafletWebViewMap';

// Client field-location card (§visibility, migration 126, 2026-08-22): shows a
// sales/RSR the on-the-ground relocation a collection/delivery officer set for
// this store — the corrected pin, the field-observed municipality, and who/when —
// right on the client-detail screen, ALONGSIDE the registered city (never
// replacing it: the registered value stays authoritative for territory/assignment
// until admin promotes a field value — owner decision 2026-08-22). Read-only: a
// sales agent views the field truth here but doesn't set pins (that's the C&D
// map + SetStoreLocationScreen). Data comes online via get_client_locations;
// renders nothing until there's at least one field location, so the common
// (never-relocated) client shows no extra chrome. See STORE_LOCATIONS_CONTRACT.md.

interface ClientFieldLocationCardProps {
  clientId: string;
  /** The store's registered municipality (clients.city) — shown next to the field one. */
  registeredCity?: string | null;
  /** Marker glyph (store/company initials); falls back to a generic dot. */
  initials?: string;
}

export function ClientFieldLocationCard({ clientId, registeredCity, initials }: ClientFieldLocationCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const [mapType, setMapType] = useState<MapTileType>('light');
  const [expanded, setExpanded] = useState(false);
  const { current, branches, loading } = useClientFieldLocations(clientId);

  const markers = useMemo<LeafletMapMarker[]>(
    () =>
      current
        ? [{
            id: 'field',
            lat: current.lat,
            lng: current.lng,
            colorHex: COLORS.ledgeGreen,
            radius: 9,
            label: 'Field-set location',
            icon: { kind: 'pin' as const, text: initials ?? '•' },
          }]
        : [],
    [current, initials]
  );

  // Nothing to show until the online read returns a field pin or branch — keeps
  // the (common) never-relocated client free of empty chrome, and is exactly the
  // graceful-degrade state when migration 126 isn't deployed / the device is offline.
  if (loading || (!current && branches.length === 0)) return null;

  const registered = registeredCity?.trim();
  const fieldArea = current?.area?.trim();
  const areaDiffers = !!fieldArea && (!registered || fieldArea !== registered);

  return (
    <>
      <BizSectionHeader title="Field-observed location" />
      <YStack
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={14}
        gap="$2.5"
      >
        {current ? (
          <>
            <XStack alignItems="center" justifyContent="space-between">
              <XStack alignItems="center" gap="$2">
                <MapPin size={15} color={COLORS.ledgeGreen} strokeWidth={2} />
                <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                  Relocated by field officer
                </Text>
              </XStack>
              <View backgroundColor={COLORS.greenSoft} borderRadius={999} paddingHorizontal={10} paddingVertical={4}>
                <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={COLORS.ledgeGreen}>Field pin</Text>
              </View>
            </XStack>

            <View borderRadius={20} overflow="hidden">
              <LeafletWebViewMapWithControls
                markers={markers}
                selectedMarkerIds={['field']}
                height={200}
                tileType={mapType}
                onTileTypeChange={setMapType}
                onExpandPress={() => setExpanded(true)}
                onMarkerPress={() => {}}
              />
            </View>

            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                {current.lat.toFixed(5)}, {current.lng.toFixed(5)}
              </Text>
              {current.setByName ? (
                <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  set by {current.setByName}
                  {current.capturedAt ? ` · ${formatShortDateTime(current.capturedAt)}` : ''}
                </Text>
              ) : null}
            </XStack>

            {/* Registered vs field municipality, side by side — the field value is
                added, never a replacement (the registered city still drives territory
                / RSR assignment until admin promotes it). Only shown when they differ. */}
            {areaDiffers ? (
              <YStack gap="$0.5">
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  Registered:{' '}
                  <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                    {registered || '—'}
                  </Text>
                </Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  Now at:{' '}
                  <Text fontFamily={BIZLINK_FONTS.semibold} color={COLORS.ledgeGreen}>
                    {current.province ? `${fieldArea}, ${current.province}` : fieldArea}
                  </Text>
                </Text>
              </YStack>
            ) : null}
          </>
        ) : null}

        {/* Additional branches — a SEPARATE store a field officer flagged at this
            client. Not the account's location; surfaced so sales/admin knows a
            branch exists and can decide whether it becomes a real account. */}
        {branches.length > 0 ? (
          <YStack gap="$2" marginTop={current ? '$1' : '$0'}>
            {current ? <View height={1} backgroundColor={BIZLINK_COLORS.line} /> : null}
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
              Additional branch{branches.length > 1 ? 'es' : ''} reported
            </Text>
            {branches.map((b) => (
              <XStack key={b.id} alignItems="center" gap="$2.5">
                <Building2 size={15} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
                <YStack flex={1} gap="$0.5">
                  <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                    {b.label?.trim() || (b.area?.trim() ? `Branch at ${b.area.trim()}` : 'Branch location')}
                  </Text>
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                    {b.lat.toFixed(5)}, {b.lng.toFixed(5)}
                    {b.setByName ? ` · set by ${b.setByName}` : ''}
                    {b.capturedAt ? ` · ${formatShortDateTime(b.capturedAt)}` : ''}
                  </Text>
                </YStack>
                <View backgroundColor={COLORS.amberSoft} borderRadius={999} paddingHorizontal={10} paddingVertical={4}>
                  <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={COLORS.orange}>Branch</Text>
                </View>
              </XStack>
            ))}
          </YStack>
        ) : null}
      </YStack>

      {/* Fullscreen map — free drag/zoom to eyeball the exact spot without the
          client-detail ScrollView stealing the pan. Only reachable when a current
          pin exists (that's the only marker). */}
      {current ? (
        <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
          <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
            <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={16} paddingVertical={12}>
              <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Field-observed location</Text>
              <Pressable onPress={() => setExpanded(false)} hitSlop={10}>
                <X size={22} color={BIZLINK_COLORS.text} strokeWidth={2} />
              </Pressable>
            </XStack>
            <View flex={1}>
              <LeafletWebViewMapWithControls
                markers={markers}
                selectedMarkerIds={['field']}
                height={0}
                tileType={mapType}
                onTileTypeChange={setMapType}
                expanded
                onMarkerPress={() => {}}
              />
            </View>
            <XStack alignItems="center" paddingHorizontal={16} paddingTop={12} paddingBottom={insets.bottom + 12}>
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                {current.lat.toFixed(5)}, {current.lng.toFixed(5)}
              </Text>
            </XStack>
          </YStack>
        </Modal>
      ) : null}
    </>
  );
}
