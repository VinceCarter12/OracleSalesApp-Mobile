import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, Landmark, Store } from 'lucide-react-native';
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
import { useCollectionOnHand } from '../../lib/use-remittance';
import { submitCollectionRemittance, type RemitDestination as RemoteDestination } from '../../lib/remittance-write';

/**
 * F-007 Remit Collections — wireframe `c-remit`. Office remittance needs an
 * assigned receiver + signed-proof photo + the receiver's digital signature;
 * 7-11/bank needs just the receipt photo. The submit uploads the proof/
 * signature and INSERTs a real `remittances` row (web 043) — online-only, since
 * the images must be uploaded before the insert (no UPDATE RLS policy).
 */

type RemitDestination = 'office' | '711' | 'bank';

// UI tile value → remote `remittances.destination` CHECK value (web 043).
const DESTINATION_REMOTE: Record<RemitDestination, RemoteDestination> = {
  office: 'office',
  '711': 'bayad_center',
  bank: 'bank_deposit',
};

function DestTile({ icon, label, selected, onPress }: { icon: React.ReactNode; label: string; selected: boolean; onPress: () => void }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <Pressable onPress={onPress}>
      <XStack
        alignItems="center"
        gap="$1.5"
        backgroundColor={selected ? BIZLINK_COLORS.ink : BIZLINK_COLORS.soft}
        borderRadius={999}
        paddingHorizontal={16}
        paddingVertical={10}
      >
        {icon}
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={selected ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}

export default function CollectionRemitScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { profileId } = useSession();
  const { summary, refresh } = useCollectionOnHand(profileId);

  const [destination, setDestination] = useState<RemitDestination>('office');
  const [receiver, setReceiver] = useState<RemitReceiver | null>(null);
  const [officeProofUri, setOfficeProofUri] = useState<string | null>(null);
  const [outsideProofUri, setOutsideProofUri] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);
  // Remounts the pad (clearing it) after a successful submit.
  const [sigPadKey, setSigPadKey] = useState(0);

  const isOffice = destination === 'office';
  const hasOnHand = summary.count > 0;
  const canSubmit =
    hasOnHand &&
    !submitting &&
    (isOffice ? receiver !== null && officeProofUri !== null && signed : outsideProofUri !== null);

  async function submit(): Promise<void> {
    if (!profileId || !canSubmit) return;
    setSubmitting(true);
    try {
      const signatureUri = isOffice ? (await sigRef.current?.captureToFile()) ?? undefined : undefined;
      const result = await submitCollectionRemittance(db, profileId, {
        destination: DESTINATION_REMOTE[destination],
        amountCollected: summary.total,
        amountRemitted: summary.total,
        visitIds: summary.ids,
        receiverName: isOffice ? receiver?.name ?? null : null,
        signedProofUri: (isOffice ? officeProofUri : outsideProofUri) ?? undefined,
        signatureUri,
      });

      if (result === 'offline') {
        Alert.alert('Walang internet', 'Kailangan ng koneksyon para mag-remit (ina-upload ang proof/signature). Subukan ulit kapag online.');
        return;
      }
      if (result === 'failed') {
        Alert.alert('Hindi na-submit', 'May problema sa pag-submit ng remittance. Pakisubukan ulit.');
        return;
      }
      Alert.alert(
        'Remittance recorded',
        `${formatPeso(summary.total)} — ${isOffice ? 'Office' : destination === '711' ? '7-11 / Bayad center' : 'Bank deposit'}`
      );
      setReceiver(null);
      setOfficeProofUri(null);
      setOutsideProofUri(null);
      setSigned(false);
      setSigPadKey((k) => k + 1);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Remit Collections" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} scrollEnabled={scrollEnabled}>
        <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={18} marginTop={6} alignItems="center">
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
            Hawak mong collections ngayon
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

        <BizSectionHeader title="Saan irere-remit?" />
        <XStack gap="$2" flexWrap="wrap">
          <DestTile
            icon={<Building2 size={14} color={isOffice ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />}
            label="Office"
            selected={isOffice}
            onPress={() => setDestination('office')}
          />
          <DestTile
            icon={<Store size={14} color={destination === '711' ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />}
            label="7-11 / Bayad center"
            selected={destination === '711'}
            onPress={() => setDestination('711')}
          />
          <DestTile
            icon={<Landmark size={14} color={destination === 'bank' ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />}
            label="Bank deposit"
            selected={destination === 'bank'}
            onPress={() => setDestination('bank')}
          />
        </XStack>

        {isOffice ? (
          <>
            <BizSectionHeader title="Assigned receiver" />
            <ReceiverPicker selectedId={receiver?.id ?? null} onSelect={setReceiver} />

            <BizSectionHeader title="Signed proof" helper="· photo ng pirmadong resibo" />
            <PhotoSlot
              title="Kuhanan ang signed acknowledgment"
              subtitle="Receiver signature required"
              uri={officeProofUri}
              onCaptured={setOfficeProofUri}
            />

            <BizSectionHeader title="Receiver digital signature" helper="· pipirma sa phone" />
            <SignaturePad ref={sigRef} key={sigPadKey} onSignedChange={setSigned} onDrawingChange={(d) => setScrollEnabled(!d)} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={6} lineHeight={18}>
              Ang digital signature ng receiver ang nagko-confirm na natanggap niya ang kabuuang halaga — required bago
              ma-submit ang office remittance.
            </Text>
          </>
        ) : (
          <>
            <BizSectionHeader title="Proof of remittance" helper="· hal. 7-11 receipt" />
            <PhotoSlot
              title="Kuhanan ang resibo"
              subtitle="Compressed ≤3MB · naka-save locally"
              uri={outsideProofUri}
              onCaptured={setOutsideProofUri}
            />
          </>
        )}

        <BizButton label={submitting ? 'Nagsa-submit…' : 'Submit Remittance'} variant="brand" onPress={submit} disabled={!canSubmit} style={{ marginTop: 20 }} />
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={10}>
          Ang amount na irere-remit ay ibabangga sa kabuuang na-collect — dapat tugma.
        </Text>
      </ScrollView>
    </YStack>
  );
}
