import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useOfficePins } from '../../../../lib/use-office-pins';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';

/**
 * Wireframe `a-officemapdetail` (Wireframe-Sales-BizLink.html ~line 1016,
 * `aOpenOfficeMap()` ~line 1380): read-only office-pin detail — a hero
 * marker card, coordinates + verification state, and the same "Pin data
 * boundary" disclaimer used on the list screen. No pin-adjust control here,
 * matching the wireframe's "Read-only detail ito. Hindi ito nag-a-adjust ng
 * pin at hindi binabago ang meeting GPS."
 *
 * Batch 9 Step C (2026-08-02): also the pin link for Lost Opportunities'
 * detail screen (`aOpenLostOfficeMap()`, Wireframe-Sales-BizLink.html
 * ~line 1390 — the mock temporarily injects the record into `aClients` and
 * reuses this exact screen). A lost opportunity's office pin belongs to a
 * DIFFERENT (former) agent's client, so it has no row in this device's local
 * `useOfficePins()` mirror — reusing this screen (per the plan's explicit
 * "do not build a second one") means accepting the pin's data as optional
 * query params instead, used only when the id isn't one of this agent's own
 * local pins. `fallbackHref` mirrors this same optionality so the back
 * button returns to whichever list opened this screen.
 */
export default function OfficeMapDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, companyName, lat, lng, verified, fallback } = useLocalSearchParams<{
    id: string;
    companyName?: string;
    lat?: string;
    lng?: string;
    verified?: string;
    fallback?: string;
  }>();
  const { pins, loading } = useOfficePins();
  const ownPin = pins.find((p) => p.id === id);
  const externalPin =
    !ownPin && lat && lng
      ? {
          id: id ?? '',
          companyName: companyName ?? 'Client',
          officeLat: Number(lat),
          officeLng: Number(lng),
          officePinUpdatedAt: null,
          verified: verified === '1',
        }
      : null;
  const pin = ownPin ?? externalPin;
  const backHref = (fallback ?? '/(tabs)/more/maps') as Href;

  // External (lost-opportunity) pins don't depend on `useOfficePins()`'s own
  // fetch — only wait on `loading` when there's no external pin to show yet.
  if (loading && !externalPin) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (!pin) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Office location" fallbackHref={backHref} />
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            There's no office location set for this client yet.
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Office location" fallbackHref={backHref} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <YStack
          height={170}
          borderRadius={24}
          backgroundColor={BIZLINK_COLORS.ink}
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          <YStack
            width={48}
            height={48}
            borderRadius={24}
            backgroundColor={pin.verified ? BIZLINK_COLORS.brand : BIZLINK_COLORS.orange}
            alignItems="center"
            justifyContent="center"
          >
            <MapPin size={20} color="#FFFFFF" strokeWidth={1.75} />
          </YStack>
        </YStack>

        <BizCard marginTop="$3" gap="$1.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text}>
            {pin.companyName}
          </Text>
          <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {pin.officeLat}, {pin.officeLng} · {pin.verified ? 'verified' : 'unverified'} office location
          </Text>
        </BizCard>

        <BizCard flat marginTop="$3" gap="$1.5">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
            Location details
          </Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={18}>
            This is read-only. It only shows the saved location — it doesn't adjust the location marker or change a meeting's location.
          </Text>
        </BizCard>
      </ScrollView>
    </YStack>
  );
}
