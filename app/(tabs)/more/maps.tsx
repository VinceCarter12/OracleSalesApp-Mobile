import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MapPinned } from 'lucide-react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useOfficePins } from '../../../lib/use-office-pins';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizFilterScroll, type BizFilterOption } from '../../../components/bizlink/BizFilterScroll';
import { BizOfficePinRow } from '../../../components/bizlink/BizOfficePinRow';

type PinFilterValue = 'all' | 'verified' | 'unverified';

const FILTER_OPTIONS: BizFilterOption<PinFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
];

/**
 * Wireframe `a-maps` (Wireframe-Sales-BizLink.html ~line 1009,
 * `aRenderOfficeMaps()` ~line 1374): "Permanent office pins lang. Hindi ito
 * meeting GPS, Online GPS, o Others location." Read-only — Sales/RSR scope
 * only (`app/(tabs)`), matching the wireframe's `#a-maps`/`#a-officemapdetail`
 * pair. Replaces the retired "Maps removed pending client confirmation"
 * placeholder per Wireframe-Gap-Audit-2026-07-29.md's "Batch 8 wireframe
 * gaps closed" entry.
 */
export default function AgentMapsScreen() {
  const insets = useSafeAreaInsets();
  const { pins, loading } = useOfficePins();
  const [filter, setFilter] = useState<PinFilterValue>('all');

  const filteredPins = pins.filter((pin) => filter === 'all' || (filter === 'verified') === pin.verified);
  const verifiedCount = pins.filter((pin) => pin.verified).length;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Maps" fallbackHref="/(tabs)/more" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Permanent office pins lang. Hindi ito meeting GPS, Online GPS, o Others location.
        </Text>

        <BizFilterScroll options={FILTER_OPTIONS} value={filter} onChange={setFilter} />

        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2.5" marginBottom="$1">
          {filteredPins.length} shown · {verifiedCount} verified
        </Text>

        <YStack marginTop="$2">
          {loading ? (
            <YStack alignItems="center" paddingVertical="$6">
              <Spinner size="large" color={BIZLINK_COLORS.brand} />
            </YStack>
          ) : filteredPins.length === 0 ? (
            <YStack alignItems="center" paddingVertical="$6" gap="$2">
              <MapPinned size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
                Walang office pin sa filter na ito.
              </Text>
            </YStack>
          ) : (
            filteredPins.map((pin) => (
              <BizOfficePinRow
                key={pin.id}
                pin={pin}
                onPress={() => router.push(`/(tabs)/more/office-map/${pin.id}`)}
              />
            ))
          )}
        </YStack>

        <BizCard flat marginTop="$3" gap="$1.5">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
            Pin data boundary
          </Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={18}>
            Read-only map ito. Verified Client Office pins lang ang permanent client location; Online at Others ay
            hindi pinagmumulan ng pin.
          </Text>
        </BizCard>
      </ScrollView>
    </YStack>
  );
}
