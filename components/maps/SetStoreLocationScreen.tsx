import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { Crosshair, MapPin } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { useStoreLocations } from '../../lib/use-store-locations';
import { addStoreLocation, setCurrentStoreLocation } from '../../lib/store-location-service';
import { captureGps } from '../../lib/gps';
import { formatShortDateTime } from '../../lib/collection-delivery-data';
import { BizTopBar } from '../bizlink/BizTopBar';
import { StatusBadge } from '../ui/StatusBadge';
import { LeafletWebViewMap, type LeafletMapMarker } from './LeafletWebViewMap';

// Store Locations (C&D maps, 2026-08-17): the set/add-location flow, shared by
// both roles. The officer standing at a relocated store drops (or GPS-captures)
// a pin and saves it as the next "Location N", which immediately becomes the
// store's current pin — no admin approval (owner decision). They can also
// re-select an older saved location if the store moved back. All writes are
// LOCAL for now (store-location-service, sync web-blocked — see the contract).

interface SetStoreLocationScreenProps {
  clientId: string;
  clientName: string;
  /** Where the top-bar back button falls back to (the map screen). */
  backHref: string;
}

export function SetStoreLocationScreen({ clientId, clientName, backHref }: SetStoreLocationScreenProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { profileId, fullName } = useSession();
  const { locations, current, refresh } = useStoreLocations(clientId || undefined);

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Seed the draggable pin from the current saved location once, without
  // clobbering a drag/GPS the officer has since made.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && current) {
      setPin({ lat: current.lat, lng: current.lng });
      seeded.current = true;
    }
  }, [current]);

  const markers = useMemo<LeafletMapMarker[]>(
    () =>
      locations.map((l) => ({
        id: `loc:${l.id}`,
        lat: l.lat,
        lng: l.lng,
        colorHex: l.isCurrent ? COLORS.ledgeGreen : '#8A968F',
        radius: 8,
        label: `Location ${l.seq}${l.isCurrent ? ' · current' : ''}`,
        icon: { kind: 'pin' as const, text: String(l.seq) },
      })),
    [locations]
  );

  async function handleUseGps(): Promise<void> {
    setCapturing(true);
    try {
      const fix = await captureGps();
      setPin(fix);
    } catch (err) {
      Alert.alert('Location', err instanceof Error ? err.message : 'Could not get your GPS location.');
    } finally {
      setCapturing(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!pin) {
      Alert.alert('Set a pin first', 'Drag the pin to the store, or tap “Use my GPS”.');
      return;
    }
    if (!clientId) {
      Alert.alert('Cannot save', 'This store has no client record to attach a location to.');
      return;
    }
    setSaving(true);
    try {
      const created = await addStoreLocation({
        clientId,
        lat: pin.lat,
        lng: pin.lng,
        setBy: profileId ?? null,
        setByName: fullName ?? null,
      });
      await refresh();
      Alert.alert('Location saved', `Set as Location ${created.seq} — now the store’s current pin.`);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReselect(locationId: string): Promise<void> {
    try {
      await setCurrentStoreLocation(clientId, locationId);
      await refresh();
    } catch (err) {
      Alert.alert('Could not update', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Set location" fallbackHref={backHref as Href} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text} marginBottom="$1">
          {clientName}
        </Text>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3">
          Drag the pin to where the store actually is, or use your current GPS, then save it.
        </Text>

        <LeafletWebViewMap
          markers={markers}
          onMarkerPress={() => {}}
          height={300}
          editablePin={pin ? { lat: pin.lat, lng: pin.lng, label: 'New location — drag me' } : null}
          onPinDragEnd={(p) => setPin(p)}
        />

        <XStack gap="$2.5" marginTop="$3">
          <Pressable style={{ flex: 1 }} onPress={handleUseGps} disabled={capturing}>
            <XStack alignItems="center" justifyContent="center" gap="$2" backgroundColor={BIZLINK_COLORS.card} borderRadius={999} paddingVertical={13}>
              {capturing ? <ActivityIndicator size="small" color={BIZLINK_COLORS.brand} /> : <Crosshair size={16} color={BIZLINK_COLORS.ink} strokeWidth={2} />}
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Use my GPS</Text>
            </XStack>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={handleSave} disabled={saving || !pin}>
            <XStack alignItems="center" justifyContent="center" gap="$2" backgroundColor={pin ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted} borderRadius={999} paddingVertical={13} opacity={saving ? 0.7 : 1}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MapPin size={16} color="#FFFFFF" strokeWidth={2} />}
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color="#FFFFFF">Save as new location</Text>
            </XStack>
          </Pressable>
        </XStack>

        <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginTop="$5" marginBottom="$2">
          Saved locations ({locations.length})
        </Text>
        {locations.length === 0 ? (
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            No locations saved yet. The one you save above becomes Location 1.
          </Text>
        ) : (
          locations.map((l) => (
            <Pressable key={l.id} onPress={() => (l.isCurrent ? undefined : handleReselect(l.id))}>
              <XStack alignItems="center" gap="$3" backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} marginBottom={10}>
                <View width={34} height={34} borderRadius={13} backgroundColor={l.isCurrent ? COLORS.greenSoft : BIZLINK_COLORS.tintA} alignItems="center" justifyContent="center">
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={l.isCurrent ? COLORS.ledgeGreen : BIZLINK_COLORS.ink}>{l.seq}</Text>
                </View>
                <YStack flex={1} gap="$0.5">
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
                    Location {l.seq}
                  </Text>
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                    {l.lat.toFixed(5)}, {l.lng.toFixed(5)}
                    {l.capturedAt ? ` · ${formatShortDateTime(l.capturedAt)}` : ''}
                  </Text>
                  {l.setByName ? (
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                      Set by {l.setByName}
                    </Text>
                  ) : null}
                </YStack>
                {l.isCurrent ? (
                  <StatusBadge label="Current" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />
                ) : (
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>Use this</Text>
                )}
              </XStack>
            </Pressable>
          ))
        )}
      </ScrollView>
    </YStack>
  );
}
