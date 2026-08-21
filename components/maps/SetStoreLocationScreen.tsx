import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { Crosshair, Hand, MapPin, Store, Trash2 } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { useStoreLocations } from '../../lib/use-store-locations';
import { addStoreLocation, deleteStoreLocation, setCurrentStoreLocation } from '../../lib/store-location-service';
import { captureGps } from '../../lib/gps';
import { formatShortDateTime } from '../../lib/collection-delivery-data';
import { CityMunicipalitySelector } from '../bizlink/CityMunicipalitySelector';
import type { PsgcLocality } from '../../lib/data/psgc-localities';
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
  /** The store's registered (sales/RSR-set) municipality — shown for context so
   * the officer knows the official area they may be relocating away from, and so
   * it's clear it is NEVER erased, only added to. */
  registeredArea?: string;
  /** Where the top-bar back button falls back to (the map screen). */
  backHref: string;
}

type LocationKind = 'relocation' | 'additional_branch';

export function SetStoreLocationScreen({ clientId, clientName, registeredArea, backHref }: SetStoreLocationScreenProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { profileId, fullName } = useSession();
  const { locations, current, refresh } = useStoreLocations(clientId || undefined);

  // Did the store MOVE here, or is this a SEPARATE additional branch? (owner
  // decision 2026-08-22) — a relocation corrects the store's pin/area; a branch
  // is a flagged, non-current second store that never overrides the account's
  // registered area. Defaults to relocation (the common case).
  const [kind, setKind] = useState<LocationKind>('relocation');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  // Canonical PSGC city/municipality — same picker the sales Create Client flow
  // uses (no free text), so a collector/driver's area is a real locality, not an
  // arbitrary string that only reads right because the header hardcodes ", Bataan".
  const [locality, setLocality] = useState<PsgcLocality | null>(null);
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

  // Pin color tells the three cases apart on the map itself (owner ask
  // 2026-08-22): an orange pin = additional branch (a separate store, never the
  // current pin), green = the store's current relocated pin, gray = an older
  // relocation the store has since moved away from. Mirrors the row chips below.
  const markers = useMemo<LeafletMapMarker[]>(
    () =>
      locations.map((l) => ({
        id: `loc:${l.id}`,
        lat: l.lat,
        lng: l.lng,
        colorHex:
          l.kind === 'additional_branch' ? COLORS.orange : l.isCurrent ? COLORS.ledgeGreen : '#8A968F',
        radius: 8,
        label:
          l.kind === 'additional_branch'
            ? `Location ${l.seq} · branch`
            : `Location ${l.seq}${l.isCurrent ? ' · current' : ''}`,
        icon: { kind: 'pin' as const, text: String(l.seq) },
      })),
    [locations]
  );

  // Which saved location the working pin currently sits on (if any). After a
  // tap it matches that location exactly (we copy its coordinates); after a
  // free drag/GPS it matches nothing, so the pin reads as a brand-new spot.
  const activeLocation = useMemo(
    () => (pin ? locations.find((l) => l.lat === pin.lat && l.lng === pin.lng) ?? null : null),
    [pin, locations]
  );
  const pinLabel = activeLocation ? `Location ${activeLocation.seq}` : 'Drop pin here';

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
        kind,
        // Canonical PSGC pick — store the municipality name AND its real province,
        // so the header reads "Municipality, Province" instead of a hardcoded Bataan.
        area: locality?.name ?? null,
        province: locality?.province ?? null,
        setBy: profileId ?? null,
        setByName: fullName ?? null,
      });
      await refresh();
      Alert.alert(
        'Location saved',
        kind === 'additional_branch'
          ? `Saved as Location ${created.seq} — flagged as an additional branch. The store's current pin and registered area are unchanged; admin reviews branches.`
          : `Set as Location ${created.seq} — now the store's current pin.`
      );
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Delete a saved pin. Confirm first, and if it's the store's current pin warn
  // that another (or the office pin) will take over — so the officer knows the
  // map will move, not just that a row disappears.
  function handleDelete(location: { id: string; seq: number; isCurrent: boolean; kind: LocationKind; area: string | null }): void {
    const name = location.area ? location.area : `Location ${location.seq}`;
    const message =
      location.kind === 'additional_branch'
        ? `Remove the branch “${name}”? This only drops the flagged branch entry.`
        : location.isCurrent
          ? `“${name}” is the store’s current pin. Deleting it makes the most recent remaining location current (or the registered office pin if none is left).`
          : `Remove “${name}” from this store’s saved locations?`;
    Alert.alert('Delete location', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStoreLocation(clientId, location.id);
            await refresh();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  async function handleReselect(locationId: string): Promise<void> {
    try {
      await setCurrentStoreLocation(clientId, locationId);
      await refresh();
    } catch (err) {
      Alert.alert('Could not update', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  // Tapping a saved "Location N" moves the working pin (and therefore the map
  // center + popup, both driven by `pin`) onto it, and promotes it to the
  // store's current pin if it isn't already. Without moving `pin`, reselecting
  // only recolored the list row while the map stayed on the previous pin.
  async function handleSelectLocation(location: { id: string; lat: number; lng: number; isCurrent: boolean }): Promise<void> {
    setPin({ lat: location.lat, lng: location.lng });
    if (!location.isCurrent) await handleReselect(location.id);
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Set location" fallbackHref={backHref as Href} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text} marginBottom="$1">
          {clientName}
        </Text>
        {registeredArea ? (
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2">
            Registered area: <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{registeredArea}</Text> · set by Sales/RSR, kept on record
          </Text>
        ) : null}

        {/* Intent — relocation vs additional branch (owner decision 2026-08-22).
            Two very different weights: a relocation corrects THIS store's pin; a
            branch is a separate second store, recorded but not applied to the
            account. Segmented so the officer must consciously pick. */}
        <XStack backgroundColor={BIZLINK_COLORS.card} borderRadius={999} padding={4} marginBottom="$2.5">
          {([
            { value: 'relocation' as const, label: 'Store moved here' },
            { value: 'additional_branch' as const, label: 'Additional branch' },
          ]).map((opt) => {
            const active = kind === opt.value;
            return (
              <Pressable key={opt.value} style={{ flex: 1 }} onPress={() => setKind(opt.value)}>
                <View backgroundColor={active ? BIZLINK_COLORS.brand : 'transparent'} borderRadius={999} paddingVertical={9} alignItems="center">
                  <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={active ? '#FFFFFF' : BIZLINK_COLORS.muted}>
                    {opt.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </XStack>
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={16}>
          {kind === 'additional_branch'
            ? 'A separate second store for this customer. It’s recorded and flagged for admin — the store’s current location and registered area stay as they are.'
            : 'The same store relocated. This becomes the store’s current pin, and the area you pick below updates its header — the registered area is still kept.'}
        </Text>

        <LeafletWebViewMap
          markers={markers}
          onMarkerPress={() => {}}
          height={300}
          editablePin={pin ? { lat: pin.lat, lng: pin.lng, label: pinLabel } : null}
          onPinDragEnd={(p) => setPin(p)}
        />

        <XStack alignItems="center" gap="$2" marginTop="$2" paddingHorizontal={12} paddingVertical={9} backgroundColor={BIZLINK_COLORS.tintA} borderRadius={14}>
          <Hand size={14} color={BIZLINK_COLORS.ink} strokeWidth={2} />
          <Text flex={1} fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.ink} lineHeight={16}>
            Tap anywhere on the map to drop the pin — or drag the green pin. Then use GPS or save.
          </Text>
        </XStack>

        {/* Pin legend — matches the marker colors so a branch pin isn't mistaken
            for the store's real current location. */}
        <XStack gap="$3" marginTop="$2" flexWrap="wrap">
          {([
            { color: COLORS.ledgeGreen, label: 'Current pin' },
            { color: '#8A968F', label: 'Past location' },
            { color: COLORS.orange, label: 'Branch' },
          ]).map((item) => (
            <XStack key={item.label} alignItems="center" gap="$1.5">
              <View width={10} height={10} borderRadius={5} backgroundColor={item.color} />
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                {item.label}
              </Text>
            </XStack>
          ))}
        </XStack>

        {/* Optional area/municipality — the SAME canonical PSGC picker the sales
            Create Client flow uses (free text can't be saved). If the store moved
            to a new municipality, choose it so the store header reads the real
            area instead of the city the sales agent set at creation. */}
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginTop="$3.5" marginBottom="$1.5">
          Area / municipality <Text fontSize={11} color={BIZLINK_COLORS.muted}>· optional</Text>
        </Text>
        <CityMunicipalitySelector value={locality} onSelect={setLocality} />

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
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color="#FFFFFF">
                {kind === 'additional_branch' ? 'Save as branch' : 'Save as new location'}
              </Text>
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
          locations.map((l) => {
            const isBranch = l.kind === 'additional_branch';
            // Every row is explicitly typed so the officer never has to guess:
            // a green "MOVED HERE" chip for a relocation, a neutral "BRANCH" chip
            // for a separate store. A branch is not a candidate for the store's
            // current pin — so it isn't tappable to re-select and shows no "Use
            // this". Only relocation history can be re-selected as current.
            const accent = isBranch ? COLORS.orange : COLORS.ledgeGreen;
            const chipBg = isBranch ? COLORS.amberSoft : COLORS.greenSoft;
            const row = (
              <XStack alignItems="center" gap="$3" backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} marginBottom={10}>
                <View width={38} height={38} borderRadius={14} backgroundColor={chipBg} alignItems="center" justifyContent="center">
                  {isBranch ? (
                    <Store size={17} color={accent} strokeWidth={2} />
                  ) : (
                    <MapPin size={17} color={accent} strokeWidth={2} />
                  )}
                </View>
                <YStack flex={1} gap="$1">
                  <XStack alignItems="center" gap="$2" flexWrap="wrap">
                    {/* The type label the user asked for — the first thing read. */}
                    <View backgroundColor={chipBg} borderRadius={999} paddingHorizontal={9} paddingVertical={3}>
                      <Text fontSize={10} fontFamily={BIZLINK_FONTS.semibold} color={accent} letterSpacing={0.3}>
                        {isBranch ? 'BRANCH' : 'MOVED HERE'}
                      </Text>
                    </View>
                    <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
                      {l.area ? l.area : `Location ${l.seq}`}
                    </Text>
                  </XStack>
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
                <XStack alignItems="center" gap="$2.5">
                  {isBranch ? null : l.isCurrent ? (
                    <StatusBadge label="Current" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />
                  ) : (
                    <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>Use this</Text>
                  )}
                  {/* Delete — clears a wrong/stale pin so it's obvious which spot
                      is the true current location. Own hitSlop so it doesn't also
                      trigger the row's re-select tap. */}
                  <Pressable
                    hitSlop={8}
                    onPress={() => handleDelete({ id: l.id, seq: l.seq, isCurrent: l.isCurrent, kind: l.kind, area: l.area })}
                  >
                    <Trash2 size={16} color={COLORS.red} strokeWidth={2} />
                  </Pressable>
                </XStack>
              </XStack>
            );
            return isBranch ? (
              <View key={l.id}>{row}</View>
            ) : (
              <Pressable key={l.id} onPress={() => handleSelectLocation(l)}>{row}</Pressable>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
