import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Banknote, Check, FileCheck, Footprints, Lock, PackageX, Smartphone } from 'lucide-react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK, COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { captureGps, type GpsFix } from '../../lib/gps';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../components/bizlink/BizButton';
import { PhotoSlot } from '../../components/collection-delivery/PhotoSlot';
import { SignaturePad, type SignaturePadHandle } from '../../components/collection-delivery/SignaturePad';
import { formatPeso, type CodMethod } from '../../lib/collection-delivery-data';
import { claimStop, deliverPo, failPo, releaseStop } from '../../lib/collection-delivery-write';
import { useDeliveryPo } from '../../lib/use-collection-delivery';

/**
 * F-007 Deliver PO — wireframe `d-deliver`, aligned to web's authoritative
 * model (044, 2026-07-27). Opened from a pending PO. Captures plate + proof
 * photo (both required, GPS rides with the proof photo) + optional signature/
 * receiver, plus a COD payment step when the PO is COD. TWO outcomes:
 *   • Delivered
 *   • Failed = backload (one outcome, not two) — requires the backload photo;
 *     the goods ride back. No 3-day follow-up window.
 * The outcome WRITE goes through collection-delivery-write.ts (local update +
 * outbox push); proof / COD / backload photos ride the shared pending_uploads
 * lane (Phase 2b). The receiver signature is drawn in-memory only (SignaturePad
 * emits no file yet), so receiver_signature_url is not uploaded — a follow-up.
 */

// COD methods are lowercase and have no 'counter' (web 044). CodMode == CodMethod.
type CodMode = CodMethod;

const COD_LABELS: Record<CodMode, string> = {
  cash: 'Take a photo of the cash',
  check: 'Take a photo of the check',
  gcash: 'Take a photo of the GCash confirmation screen',
};

function PayTile({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
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

function OutcomeTab({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <XStack
        alignItems="center"
        justifyContent="center"
        gap="$1.5"
        backgroundColor={selected ? BIZLINK_COLORS.card : 'transparent'}
        borderRadius={20}
        paddingVertical={11}
      >
        {icon}
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={selected ? BIZLINK_COLORS.text : BIZLINK_COLORS.muted}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}

export default function DeliverPoScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const poId = String(id ?? '');
  const db = useSQLiteContext();
  const { profileId, fullName } = useSession();
  // Real record from the local mirror for display; the deliver/fail/claim WRITE
  // goes through collection-delivery-write.ts (local update + outbox push).
  const { po, loading, refresh } = useDeliveryPo(poId);

  // Outcome is chosen up-front via tabs (not two buttons at the end): the
  // driver picks Deliver or Failed / Backload first, then only sees that path.
  const [mode, setMode] = useState<'deliver' | 'failed'>('deliver');
  const [plate, setPlate] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [receiver, setReceiver] = useState('');
  const [signed, setSigned] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [codMode, setCodMode] = useState<CodMode>('cash');
  const [codPhotoUri, setCodPhotoUri] = useState<string | null>(null);
  const [codAmount, setCodAmount] = useState('');
  const [backloadUri, setBackloadUri] = useState<string | null>(null);
  // GPS captured when the proof (or backload) photo is taken — rides with it.
  const [gps, setGps] = useState<GpsFix | null>(null);

  const isCod = !!po?.cod;
  const codAmountValue = parseFloat((codAmount || '').replace(/[^\d.]/g, ''));
  const codOk = !isCod || (codAmountValue > 0 && !!codPhotoUri);
  const claimedByMe = !!po?.claimedById && po.claimedById === profileId;
  const claimedByOther = !!po?.claimedById && !claimedByMe;
  const canDeliver = plate.trim().length > 0 && !!proofUri && codOk && !claimedByOther;

  function codIconColor(mode: CodMode) {
    return codMode === mode ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted;
  }

  async function captureWithGps(setUri: (uri: string) => void, uri: string): Promise<void> {
    setUri(uri);
    try {
      setGps(await captureGps());
    } catch {
      // Photo taken but GPS unavailable → no pin.
    }
  }

  async function claim(): Promise<void> {
    if (!profileId) return;
    await claimStop(db, 'purchase_orders', poId, profileId, fullName ?? 'Driver');
    refresh();
  }

  async function release(): Promise<void> {
    if (!profileId) return;
    await releaseStop(db, 'purchase_orders', poId, profileId);
    refresh();
  }

  // The proof/backload capture kicks off a GPS read, but the driver may confirm
  // before it resolves (or it may have failed) — make one solid attempt so a
  // completed stop isn't saved with a null pin.
  async function resolveGps(): Promise<GpsFix | null> {
    if (gps) return gps;
    try {
      return await captureGps();
    } catch {
      return null; // No fix available → save without a pin.
    }
  }

  async function confirmDeliver(): Promise<void> {
    if (!profileId) return;
    const fix = await resolveGps();
    // Render the drawn signature to a JPEG (null if the customer didn't sign —
    // it's optional). It rides the deferred upload lane to receiver_signature_url.
    const signatureUri = (await sigRef.current?.captureToFile()) ?? undefined;
    await deliverPo(db, poId, profileId, {
      plate: plate.trim(),
      receiver,
      signed,
      gps: fix ?? undefined,
      cod: isCod ? { amount: codAmountValue, method: codMode } : undefined,
      proofUri: proofUri ?? undefined,
      codPhotoUri: codPhotoUri ?? undefined,
      signatureUri,
    });
    router.replace('/(delivery)/celebrate');
  }

  // Failed = backload (one outcome). The backload photo is the proof that the
  // goods rode back — required before we accept a failed stop.
  async function failedBackload(): Promise<void> {
    if (!backloadUri) {
      Alert.alert('Backload proof needed', 'Please take a photo of the backloaded items first.');
      return;
    }
    if (!profileId) return;
    const fix = await resolveGps();
    await failPo(db, poId, profileId, { gps: fix ?? undefined, backloadUri: backloadUri ?? undefined });
    Alert.alert('Failed / backload logged', 'Nothing was received — the goods came back. Waiting for the dispatcher or admin to take action.');
    router.back();
  }

  if (loading || !po) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Deliver PO" />
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$6">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            {loading ? 'Loading…' : 'This PO could not be found.'}
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Deliver PO" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} scrollEnabled={scrollEnabled}>
        {/* PO header */}
        <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={16} marginTop={6}>
          <XStack alignItems="center" gap="$2" marginBottom={6} flexWrap="wrap">
            <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{po.po}</Text>
            <StatusBadge label="Pending" background={COLORS.blueSoft} color={COLORS.blue} />
            {isCod ? <StatusBadge label="COD" background={COLORS.purpleSoft} color={COLORS.purple} /> : null}
          </XStack>
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {po.client} · {po.area}, Bataan
          </Text>
        </YStack>

        {/* Claim / "On the way" — hard lock (web 046) */}
        {po.status === 'pending' ? (
          claimedByOther ? (
            <XStack alignItems="center" gap="$2.5" backgroundColor={BIZLINK_COLORS.tintB} borderRadius={16} paddingHorizontal={14} paddingVertical={12} marginTop={10}>
              <Lock size={16} color={COLORS.ledgeRed} strokeWidth={1.75} />
              <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={COLORS.ledgeRed} lineHeight={16}>
                {po.claimedBy} is on the way — you can’t take this one.
              </Text>
            </XStack>
          ) : claimedByMe ? (
            <XStack alignItems="center" gap="$2.5" backgroundColor={BIZLINK_COLORS.tintA} borderRadius={16} paddingHorizontal={14} paddingVertical={10} marginTop={10}>
              <Footprints size={16} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
              <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>You’re on the way here.</Text>
              <Pressable onPress={release} hitSlop={6}>
                <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>Release</Text>
              </Pressable>
            </XStack>
          ) : (
            <BizButton label="Claim — I’m on the way" variant="white" onPress={claim} icon={<Footprints size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />} style={{ marginTop: 10 }} />
          )
        ) : null}

        {/* Outcome tabs — pick Deliver or Failed / Backload up-front (web 044). */}
        <XStack
          backgroundColor={BIZLINK_COLORS.soft}
          borderRadius={24}
          padding={4}
          marginTop={16}
          gap="$1"
          overflow="hidden"
        >
          <OutcomeTab
            icon={<Check size={16} color={mode === 'deliver' ? BIZLINK_COLORS.text : BIZLINK_COLORS.muted} strokeWidth={2} />}
            label="Deliver"
            selected={mode === 'deliver'}
            onPress={() => setMode('deliver')}
          />
          <OutcomeTab
            icon={<PackageX size={16} color={mode === 'failed' ? BIZLINK_COLORS.text : BIZLINK_COLORS.muted} strokeWidth={1.75} />}
            label="Failed / Backload"
            selected={mode === 'failed'}
            onPress={() => setMode('failed')}
          />
        </XStack>

        {/* Auto-captured (dark card) — GPS rides with the proof/backload photo (web 044). */}
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={0.5} color={BIZLINK_COLORS.muted} marginTop={16} marginBottom={6}>
          AUTO-CAPTURED
        </Text>
        <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16} gap="$1.5">
          <XStack alignItems="center" gap="$2">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color="#8FD7B4">✓</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.solid}>Date &amp; time</Text>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Jul 9, 2026 · 9:41 AM</Text>
          </XStack>
          <XStack alignItems="center" gap="$2">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={gps ? '#8FD7B4' : BIZLINK_ON_INK.textMuted}>{gps ? '✓' : '…'}</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.solid}>GPS pinpoint</Text>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
              {gps ? `${gps.lat.toFixed(4)}° N, ${gps.lng.toFixed(4)}° E` : 'captured with the proof photo'}
            </Text>
          </XStack>
        </YStack>

        {mode === 'deliver' ? (
          <>
        {/* Truck plate */}
        <BizSectionHeader title="Truck plate number *" />
        <TextInput
          value={plate}
          onChangeText={setPlate}
          autoCapitalize="characters"
          placeholder="e.g. ABC 1234"
          placeholderTextColor={BIZLINK_COLORS.muted}
          style={{
            height: 52,
            borderRadius: 16,
            paddingHorizontal: 16,
            backgroundColor: BIZLINK_COLORS.card,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
          }}
        />
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={4} lineHeight={18}>
          Per-trip reference, shown with the customer name on the trip ticket.
        </Text>

        {/* Proof of delivery */}
        <BizSectionHeader title="Proof of delivery" helper="· camera only" />
        <PhotoSlot
          title="Take a photo of the delivered items"
          subtitle="Compressed ≤3MB · saved on your phone"
          uri={proofUri}
          onCaptured={(uri) => captureWithGps(setProofUri, uri)}
        />

        {/* Receiver signature (optional) */}
        <BizSectionHeader title="Receiver signature" helper="· optional" />
        <SignaturePad
          ref={sigRef}
          onSignedChange={setSigned}
          onDrawingChange={(d) => setScrollEnabled(!d)}
          hint="Have the receiver sign here (optional)"
        />

        {/* Received by (optional) */}
        <BizSectionHeader title="Received by" helper="· optional" />
        <TextInput
          value={receiver}
          onChangeText={setReceiver}
          placeholder="Receiver’s name (if they’re willing to give it)"
          placeholderTextColor={BIZLINK_COLORS.muted}
          style={{
            height: 52,
            borderRadius: 16,
            paddingHorizontal: 16,
            backgroundColor: BIZLINK_COLORS.card,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
          }}
        />

        {/* COD payment step — only for COD POs */}
        {isCod ? (
          <>
            <BizSectionHeader title="Payment Method" helper={`· ${formatPeso(po.codDue ?? 0)} due`} />
            <XStack gap="$2" flexWrap="wrap">
              <PayTile icon={<Banknote size={14} color={codIconColor('cash')} strokeWidth={1.75} />} label="Cash" selected={codMode === 'cash'} onPress={() => setCodMode('cash')} />
              <PayTile icon={<FileCheck size={14} color={codIconColor('check')} strokeWidth={1.75} />} label="Check" selected={codMode === 'check'} onPress={() => setCodMode('check')} />
              <PayTile icon={<Smartphone size={14} color={codIconColor('gcash')} strokeWidth={1.75} />} label="GCash" selected={codMode === 'gcash'} onPress={() => setCodMode('gcash')} />
            </XStack>

            <BizSectionHeader title="Payment photo" helper="· camera only" />
            <PhotoSlot
              title={COD_LABELS[codMode]}
              subtitle="Compressed ≤3MB · saved on your phone"
              uri={codPhotoUri}
              onCaptured={setCodPhotoUri}
            />

            <BizSectionHeader title="Amount collected *" />
            <TextInput
              value={codAmount}
              onChangeText={setCodAmount}
              keyboardType="numeric"
              placeholder="₱ 0.00"
              placeholderTextColor={BIZLINK_COLORS.muted}
              style={{
                height: 52,
                borderRadius: 16,
                paddingHorizontal: 16,
                backgroundColor: BIZLINK_COLORS.card,
                fontFamily: BIZLINK_FONTS.semibold,
                fontSize: 20,
                letterSpacing: -0.5,
                color: BIZLINK_COLORS.text,
              }}
            />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={6} lineHeight={18}>
              Same payment step as the Collection module — reused for COD deliveries.
            </Text>
          </>
        ) : null}

        {/* Remarks */}
        <BizSectionHeader title="Remarks" />
        <TextInput
          placeholder="Notes / comments…"
          placeholderTextColor={BIZLINK_COLORS.muted}
          multiline
          style={{
            minHeight: 74,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: BIZLINK_COLORS.card,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            textAlignVertical: 'top',
          }}
        />

        {/* Deliver outcome */}
        <BizButton
          label="Delivered"
          variant="brand"
          onPress={confirmDeliver}
          disabled={!canDeliver}
          icon={<Check size={17} color={BIZLINK_ON_INK.solid} strokeWidth={2} />}
          style={{ marginTop: 20 }}
        />
          </>
        ) : (
          <>
        {/* Backload proof — required to log a failed (= backload) stop */}
        <BizSectionHeader title="Backload proof" helper="· camera only" />
        <PhotoSlot
          title="Take a photo of the backloaded items"
          subtitle="Compressed ≤3MB · saved on your phone"
          uri={backloadUri}
          onCaptured={(uri) => captureWithGps(setBackloadUri, uri)}
        />

        {/* Remarks */}
        <BizSectionHeader title="Remarks" />
        <TextInput
          placeholder="Notes / comments… (e.g. backload — hindi kinuha ang delivery)"
          placeholderTextColor={BIZLINK_COLORS.muted}
          multiline
          style={{
            minHeight: 74,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: BIZLINK_COLORS.card,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            textAlignVertical: 'top',
          }}
        />

        {/* Failed outcome */}
        <BizButton
          label="Failed / Backload"
          variant="red"
          onPress={failedBackload}
          disabled={claimedByOther}
          icon={<PackageX size={16} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />}
          style={{ marginTop: 20, backgroundColor: COLORS.ledgeRed }}
        />
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={10} lineHeight={18}>
          One day, one result. Failed = nothing received and the goods come back (= backload) — a backload photo is
          required before you can log it.
        </Text>
          </>
        )}
      </ScrollView>
    </YStack>
  );
}
