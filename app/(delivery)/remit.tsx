import { useRef, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2 } from 'lucide-react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK, COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizButton } from '../../components/bizlink/BizButton';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { PhotoSlot } from '../../components/collection-delivery/PhotoSlot';
import { SignaturePad, type SignaturePadHandle } from '../../components/collection-delivery/SignaturePad';
import { ReceiverPicker } from '../../components/collection-delivery/ReceiverPicker';
import { formatPeso, type RemitReceiver } from '../../lib/collection-delivery-data';
import { useCodOnHand } from '../../lib/use-remittance';
import { submitCodRemittance } from '../../lib/remittance-write';

/**
 * F-007 Remit COD Collections — wireframe `d-remit`. Office-ONLY destination
 * (Meeting-2026-07-25 Addendum 4) and the receiver signature is ALWAYS
 * required. Submit uploads the proof/signature and INSERTs a real
 * `cod_remittances` row (web 044), then flags the covered POs `cod_remitted`.
 * Online-only (images upload before the insert; no UPDATE RLS policy).
 */
export default function DeliveryRemitScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { profileId } = useSession();
  const { summary, refresh } = useCodOnHand(profileId);

  const [receiver, setReceiver] = useState<RemitReceiver | null>(null);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);
  const [sigPadKey, setSigPadKey] = useState(0);

  const hasOnHand = summary.count > 0;
  const canSubmit = hasOnHand && !submitting && receiver !== null && proofUri !== null && signed;

  async function submit(): Promise<void> {
    if (!profileId || !receiver || !canSubmit) return;
    setSubmitting(true);
    try {
      const signatureUri = (await sigRef.current?.captureToFile()) ?? undefined;
      const result = await submitCodRemittance(db, profileId, {
        amountCollected: summary.total,
        amountRemitted: summary.total,
        poIds: summary.ids,
        receiverName: receiver.name,
        signatureUri,
      });

      if (result === 'offline') {
        Alert.alert('Walang internet', 'Kailangan ng koneksyon para mag-remit (ina-upload ang signature). Subukan ulit kapag online.');
        return;
      }
      if (result === 'failed') {
        Alert.alert('Hindi na-submit', 'May problema sa pag-submit ng COD remittance. Pakisubukan ulit.');
        return;
      }
      Alert.alert('Remittance recorded', `${formatPeso(summary.total)} — Office`);
      setReceiver(null);
      setProofUri(null);
      setSigned(false);
      setSigPadKey((k) => k + 1);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Remit COD Collections" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} scrollEnabled={scrollEnabled}>
        <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={18} marginTop={6} alignItems="center">
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
            Hawak mong COD ngayon
          </Text>
          <Text fontSize={42} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-1.5} color={BIZLINK_ON_INK.solid} marginTop={6}>
            {formatPeso(summary.total)}
          </Text>
          <XStack gap="$2" marginTop={12} flexWrap="wrap" justifyContent="center">
            <StatusBadge label={`Cash ${formatPeso(summary.byMethod.cash)}`} background={COLORS.purpleSoft} color={COLORS.purple} />
            <StatusBadge label={`Check ${formatPeso(summary.byMethod.check)}`} background={COLORS.blueSoft} color={COLORS.blue} />
            <StatusBadge label={`GCash ${formatPeso(summary.byMethod.gcash)}`} background={COLORS.blueSoft} color={COLORS.blue} />
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
        <ReceiverPicker selectedId={receiver?.id ?? null} onSelect={setReceiver} />

        <BizSectionHeader title="Signed proof" helper="· photo ng pirmadong resibo" />
        <PhotoSlot
          title="Kuhanan ang signed acknowledgment"
          subtitle="Receiver signature required"
          uri={proofUri}
          onCaptured={setProofUri}
        />

        <BizSectionHeader title="Receiver digital signature" helper="· pipirma sa phone" />
        <SignaturePad ref={sigRef} key={sigPadKey} onSignedChange={setSigned} onDrawingChange={(d) => setScrollEnabled(!d)} />

        <BizButton label={submitting ? 'Nagsa-submit…' : 'Submit Remittance'} variant="brand" onPress={submit} disabled={!canSubmit} style={{ marginTop: 20 }} />
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={10} lineHeight={18}>
          Office lang ang remit option para sa delivery COD (2026-07-25 correction) — hindi tulad ng Collection na may
          7-11/bank option din.
        </Text>
      </ScrollView>
    </YStack>
  );
}
