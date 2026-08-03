import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Crosshair, MapPin } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import { getClientById, setOfficeLocation, hasOfficePin } from '../../../lib/client-service';
import { captureGps } from '../../../lib/gps';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizButton } from '../../../components/bizlink/BizButton';
import type { Client } from '../../../types';

/**
 * Client Detail's Set/Update Office Location flow (Wireframe
 * `a-officemapdetail` / `aOpenOfficeMap()`, Wireframe-Sales-BizLink.html
 * lines 1301-1302) — GPS-capture-only per Vince's decision 4 (2026-07-29,
 * [[Sprint#Batch 4 - Office Location Core (2026-07-29 Pre-Implementation
 * Vault Update)]]): no map, no drag-to-adjust pin. That is explicitly
 * deferred to its own future architecture-reviewer pass.
 *
 * Reuses `lib/gps.ts::captureGps()` as-is, including its last-known-position
 * fallback (Vince explicitly approved reusing the same behavior every other
 * GPS capture in this app already has — no stricter no-fallback variant).
 */
export default function OfficeLocationScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { profileId } = useSession();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClient = useCallback(async () => {
    if (!clientId) return;
    const foundClient = await getClientById(clientId);
    if (!foundClient) {
      setError('Client not found.');
    } else {
      setClient(foundClient);
      setError(null);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  useFocusEffect(
    useCallback(() => {
      loadClient();
    }, [loadClient])
  );

  async function handleCapture(): Promise<void> {
    if (!clientId || !profileId) return;
    setSaving(true);
    setError(null);
    try {
      const gps = await captureGps();
      await setOfficeLocation({
        clientId,
        agentId: profileId,
        lat: gps.lat,
        lng: gps.lng,
        source: 'manual',
      });
      showToast('Office location saved.');
      await loadClient();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to capture office location.';
      setError(message);
      Alert.alert('Office Location Error', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor={BIZLINK_COLORS.canvas} gap="$3">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Client not found.</Text>
        <BizButton label="Go back" variant="white" onPress={() => router.back()} />
      </YStack>
    );
  }

  const hasPin = hasOfficePin(client.office_lat, client.office_lng);
  // Real data-driven verified/unverified distinction (Wireframe-Sales-
  // BizLink.html:1389 aOpenOfficeMap — verified = brand green pin, unverified
  // = orange pin): maps directly onto the existing `office_pin_source`
  // column rather than inventing a new field — 'client_office_meeting' is
  // set only when a verified Client Office visit captured the pin (see
  // lib/client-service.ts), 'manual' is this screen's own GPS capture.
  const verified = hasPin && client.office_pin_source === 'client_office_meeting';

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Office location" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {/* Wireframe-Sales-BizLink.html:1389 aOpenOfficeMap() `.hero` pin
            visual — dashed inset frame, centered pin circle (brand = verified,
            orange = unverified, muted soft when no pin yet), micro caption
            bottom-left. */}
        <YStack
          backgroundColor={BIZLINK_COLORS.ink}
          borderRadius={24}
          minHeight={170}
          padding={18}
          position="relative"
          overflow="hidden"
        >
          <View
            position="absolute"
            top={18}
            left={18}
            right={18}
            bottom={18}
            borderRadius={18}
            borderWidth={1}
            borderStyle="dashed"
            borderColor="rgba(255,255,255,0.32)"
          />
          <YStack flex={1} alignItems="center" justifyContent="center">
            <View
              width={48}
              height={48}
              borderRadius={24}
              alignItems="center"
              justifyContent="center"
              backgroundColor={hasPin ? (verified ? BIZLINK_COLORS.brand : BIZLINK_COLORS.orange) : BIZLINK_ON_INK.circleFill}
            >
              <MapPin size={20} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
            </View>
          </YStack>
          <Text position="absolute" bottom={14} left={18} fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.solid}>
            {hasPin ? (verified ? 'Verified office pin' : 'Unverified office pin') : 'No office pin saved'}
          </Text>
        </YStack>

        <BizCard marginTop="$3" gap="$2">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text}>
            {client.company_name}
          </Text>
          <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {hasPin ? (client.office_address ?? 'No address on file.') : 'Wala pang office location.'}
          </Text>
          <XStack gap="$1.5" alignItems="center">
            <Crosshair size={13} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {hasPin
                ? `${client.office_lat}, ${client.office_lng} · ${verified ? 'verified' : 'unverified'} office location`
                : 'No office pin saved.'}
            </Text>
          </XStack>
        </BizCard>

        {/* Wireframe-Sales-BizLink.html:1389 "Pin data boundary" card, adapted from the demo's copy. */}
        <BizCard flat marginTop="$3" gap="$1.5">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
            Pin data boundary
          </Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={18}>
            Meeting GPS stays inside each meeting record. Only a verified Client Office visit — or this explicit
            capture — can set or update this permanent pin. Online and Others meetings never update it.
          </Text>
        </BizCard>

        {error ? (
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginTop="$2">
            {error}
          </Text>
        ) : null}

        <YStack marginTop="$4">
          <BizButton
            label={saving ? 'Capturing…' : hasPin ? 'Update from GPS' : 'Set office location'}
            icon={<Crosshair size={15} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />}
            onPress={handleCapture}
            disabled={saving}
          />
        </YStack>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$2.5">
          Gagana kahit walang signal — mase-save locally, auto-sync mamaya.
        </Text>
      </ScrollView>
    </YStack>
  );
}
