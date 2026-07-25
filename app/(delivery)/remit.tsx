import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2 } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK, COLORS } from '../../lib/theme';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizButton } from '../../components/bizlink/BizButton';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { PhotoSlot } from '../../components/collection-delivery/PhotoSlot';
import { SignaturePad } from '../../components/collection-delivery/SignaturePad';
import { ReceiverPicker } from '../../components/collection-delivery/ReceiverPicker';
import { DELIVERY_POS, formatPeso, getDeliverySummary } from '../../lib/collection-delivery-data';

/**
 * F-007 first draft (2026-07-25): Remit COD Collections — wireframe `d-remit`.
 * Office-ONLY destination (Meeting-2026-07-25 Addendum 4 — never copy
 * Collection's 7-11/bank tiles here; the single Office tile renders
 * non-interactive for visual consistency) and the receiver signature is
 * ALWAYS required. Submit is UI-only for now — no schema/outbox entity
 * exists yet (Database.md "Planned schema notes — F-007").
 */
export default function DeliveryRemitScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const summary = getDeliverySummary();

  const [receiverId, setReceiverId] = useState<number | null>(null);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [sigPadKey, setSigPadKey] = useState(0);

  const totalBy = (method: string) =>
    DELIVERY_POS.filter((p) => p.cod && p.status === 'delivered' && !p.codRemitted && p.codMethod === method)
      .reduce((a, p) => a + (p.codAmount ?? 0), 0);

  const canSubmit = receiverId !== null && proofUri !== null && signed;

  function submit(): void {
    Alert.alert(
      'Remittance recorded',
      `${formatPeso(summary.codOnHand)} — Office\n\nFirst draft: UI lang muna — hindi pa ito nase-save o nasi-sync (walang F-007 schema pa).`
    );
    setReceiverId(null);
    setProofUri(null);
    setSigned(false);
    setSigPadKey((k) => k + 1);
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$2">
        <Text fontSize={21} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-0.4} color={BIZLINK_COLORS.text}>
          Remit COD Collections
        </Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }} scrollEnabled={scrollEnabled}>
        <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={18} marginTop={6} alignItems="center">
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
            Hawak mong COD ngayon
          </Text>
          <Text fontSize={42} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-1.5} color={BIZLINK_ON_INK.solid} marginTop={6}>
            {formatPeso(summary.codOnHand)}
          </Text>
          <XStack gap="$2" marginTop={12} flexWrap="wrap" justifyContent="center">
            <StatusBadge label={`Cash ${formatPeso(totalBy('Cash'))}`} background={COLORS.purpleSoft} color={COLORS.purple} />
            <StatusBadge label={`Check ${formatPeso(totalBy('Check'))}`} background={COLORS.blueSoft} color={COLORS.blue} />
            <StatusBadge label={`GCash ${formatPeso(totalBy('GCash'))}`} background={COLORS.blueSoft} color={COLORS.blue} />
          </XStack>
        </YStack>

        <BizSectionHeader title="Saan irere-remit?" helper="· Office lang para sa delivery COD" />
        <XStack>
          <XStack
            alignItems="center"
            gap="$1.5"
            backgroundColor={BIZLINK_COLORS.ink}
            borderRadius={999}
            paddingHorizontal={16}
            paddingVertical={10}
          >
            <Building2 size={14} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.solid}>Office</Text>
          </XStack>
        </XStack>

        <BizSectionHeader title="Assigned receiver" />
        <ReceiverPicker selectedId={receiverId} onSelect={(r) => setReceiverId(r.id)} />

        <BizSectionHeader title="Signed proof" helper="· photo ng pirmadong resibo" />
        <PhotoSlot
          title="Kuhanan ang signed acknowledgment"
          subtitle="Receiver signature required"
          uri={proofUri}
          onCaptured={setProofUri}
        />

        <BizSectionHeader title="Receiver digital signature" helper="· pipirma sa phone" />
        <SignaturePad key={sigPadKey} onSignedChange={setSigned} onDrawingChange={(d) => setScrollEnabled(!d)} />

        <BizButton label="Submit Remittance" variant="brand" onPress={submit} disabled={!canSubmit} style={{ marginTop: 20 }} />
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={10} lineHeight={18}>
          Office lang ang remit option para sa delivery COD (2026-07-25 correction) — hindi tulad ng Collection na may
          7-11/bank option din.
        </Text>
      </ScrollView>
    </YStack>
  );
}
