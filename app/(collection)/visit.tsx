import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  CalendarClock,
  Check,
  FileCheck,
  Footprints,
  Lightbulb,
  Lock,
  MessageSquareWarning,
  Receipt,
  Smartphone,
} from 'lucide-react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK, COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { captureGps, type GpsFix } from '../../lib/gps';
import { Avatar } from '../../components/ui/Avatar';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../components/bizlink/BizButton';
import { PhotoSlot } from '../../components/collection-delivery/PhotoSlot';
import { type PaymentMethod } from '../../lib/collection-delivery-data';
import { claimStop, collectPayment, releaseStop, rescheduleVisit } from '../../lib/collection-delivery-write';
import { useCollectionStore } from '../../lib/use-collection-delivery';

/**
 * F-007 first draft (2026-07-25): Collect Payment — wireframe `c-visit`.
 * Opened from a pending row in Today's List. Auto-captures GPS + timestamp
 * (mocked here), takes a payment-method + payment photo + amount + delivery-
 * receipt photo, then marks the store collected. The "✓ Collected" button
 * unlocks only when amount > 0 AND both photos are captured (wireframe
 * cCheckCollectForm). No F-007 schema yet — the collect mutates the in-memory
 * mock store and nothing persists/syncs (Database.md "Planned schema notes").
 *
 * Amount entry deliberately shows NO target/expected amount (2026-07-25
 * anchoring-bias decision) — the collector types the actual amount received.
 */

// PayMode is exactly the (lowercase) PaymentMethod union — 'counter' is a real
// stored value now (2026-07-26 / web 043), not folded into 'cash'.
type PayMode = PaymentMethod;

const PAY_LABELS: Record<PayMode, string> = {
  cash: 'Kuhanan ang cash',
  check: 'Kuhanan ang check',
  gcash: 'Kuhanan ang GCash confirmation screen',
  counter: 'Kuhanan ang counter receipt',
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

export default function CollectPaymentScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const storeId = String(id ?? '');
  const db = useSQLiteContext();
  const { profileId, fullName } = useSession();
  // Real record from the local mirror for display; the collect/reschedule/claim
  // WRITE goes through collection-delivery-write.ts (local update + outbox push).
  const { store, loading, refresh } = useCollectionStore(storeId);

  const [payMode, setPayMode] = useState<PayMode>('cash');
  const [payPhotoUri, setPayPhotoUri] = useState<string | null>(null);
  const [receiptPhotoUri, setReceiptPhotoUri] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  // GPS captured at the moment the payment photo is taken (web rule: the fix
  // rides with the photo). Null = "no pin" — never synthesized.
  const [gps, setGps] = useState<GpsFix | null>(null);

  const amountValue = parseFloat((amount || '').replace(/[^\d.]/g, ''));
  const amountValid = amountValue > 0;
  const claimedByMe = !!store?.claimedById && store.claimedById === profileId;
  const claimedByOther = !!store?.claimedById && !claimedByMe;
  const canCollect = amountValid && !!payPhotoUri && !!receiptPhotoUri && !claimedByOther;

  function iconColor(mode: PayMode) {
    return payMode === mode ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted;
  }

  async function onPayPhoto(uri: string): Promise<void> {
    setPayPhotoUri(uri);
    try {
      setGps(await captureGps());
    } catch {
      // Photo taken but GPS unavailable → no pin (web renders it as such).
    }
  }

  async function claim(): Promise<void> {
    if (!profileId) return;
    await claimStop(db, 'collection_visits', storeId, profileId, fullName ?? 'Collector');
    refresh();
  }

  async function release(): Promise<void> {
    if (!profileId) return;
    await releaseStop(db, 'collection_visits', storeId, profileId);
    refresh();
  }

  async function confirmCollect(): Promise<void> {
    if (!profileId) return;
    await collectPayment(db, storeId, profileId, {
      method: payMode,
      amount: amountValue,
      gps: gps ?? undefined,
      remarks,
    });
    router.replace('/(collection)/celebrate');
  }

  function reschedule(): void {
    Alert.alert(
      'Reschedule visit',
      `${store?.name ?? 'Store'} — hindi aabutin ngayong araw?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I-reschedule bukas',
          onPress: async () => {
            if (!profileId) return;
            const tomorrow = new Date(Date.now() + 86400000).toISOString();
            await rescheduleVisit(db, storeId, tomorrow, profileId, remarks);
            router.back();
          },
        },
      ]
    );
  }

  if (loading || !store) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Collect Payment" />
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$6">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            {loading ? 'Naglo-load…' : 'Hindi mahanap ang store na ito.'}
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Collect Payment" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Store header */}
        <XStack
          alignItems="center"
          gap="$3"
          backgroundColor={BIZLINK_COLORS.card}
          borderRadius={24}
          padding={16}
          marginTop={6}
        >
          <Avatar initials={store.initials} background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15} color={BIZLINK_COLORS.text}>{store.name}</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{store.area}, Bataan</Text>
          </YStack>
        </XStack>

        {/* Claim / "On the way" — hard lock (web 046) */}
        {store.status === 'pending' ? (
          claimedByOther ? (
            <XStack alignItems="center" gap="$2.5" backgroundColor={BIZLINK_COLORS.tintB} borderRadius={16} paddingHorizontal={14} paddingVertical={12} marginTop={10}>
              <Lock size={16} color={COLORS.ledgeRed} strokeWidth={1.75} />
              <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={COLORS.ledgeRed} lineHeight={16}>
                On the way na si {store.claimedBy} — hindi mo ito pwedeng kunin.
              </Text>
            </XStack>
          ) : claimedByMe ? (
            <XStack alignItems="center" gap="$2.5" backgroundColor={BIZLINK_COLORS.tintA} borderRadius={16} paddingHorizontal={14} paddingVertical={10} marginTop={10}>
              <Footprints size={16} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
              <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>On the way ka na papunta rito.</Text>
              <Pressable onPress={release} hitSlop={6}>
                <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>Release</Text>
              </Pressable>
            </XStack>
          ) : (
            <BizButton label="Claim — On the way na ako" variant="white" onPress={claim} icon={<Footprints size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />} style={{ marginTop: 10 }} />
          )
        ) : null}

        {/* Auto-captured (dark card) */}
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={0.5} color={BIZLINK_COLORS.muted} marginTop={16} marginBottom={6}>
          AUTO-CAPTURED
        </Text>
        <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16} gap="$1.5">
          <XStack alignItems="center" gap="$2">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={gps ? '#8FD7B4' : BIZLINK_ON_INK.textMuted}>{gps ? '✓' : '…'}</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.solid}>GPS pinpoint</Text>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
              {gps ? `${gps.lat.toFixed(4)}° N, ${gps.lng.toFixed(4)}° E` : 'kukunin kasabay ng payment photo'}
            </Text>
          </XStack>
          <XStack alignItems="center" gap="$2">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color="#8FD7B4">✓</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.solid}>Date &amp; time</Text>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Jul 9, 2026 · 9:41 AM</Text>
          </XStack>
        </YStack>

        {/* Payment method */}
        <BizSectionHeader title="Payment method" />
        <XStack gap="$2" flexWrap="wrap">
          <PayTile icon={<Banknote size={14} color={iconColor('cash')} strokeWidth={1.75} />} label="Cash" selected={payMode === 'cash'} onPress={() => setPayMode('cash')} />
          <PayTile icon={<FileCheck size={14} color={iconColor('check')} strokeWidth={1.75} />} label="Check" selected={payMode === 'check'} onPress={() => setPayMode('check')} />
          <PayTile icon={<Smartphone size={14} color={iconColor('gcash')} strokeWidth={1.75} />} label="GCash" selected={payMode === 'gcash'} onPress={() => setPayMode('gcash')} />
          <PayTile icon={<Receipt size={14} color={iconColor('counter')} strokeWidth={1.75} />} label="Counter" selected={payMode === 'counter'} onPress={() => setPayMode('counter')} />
        </XStack>

        {/* Payment photo */}
        <BizSectionHeader title="Photo ng bayad" helper="· camera only" />
        <PhotoSlot
          title={PAY_LABELS[payMode]}
          subtitle="Compressed ≤3MB · naka-save locally"
          uri={payPhotoUri}
          onCaptured={onPayPhoto}
        />

        {/* Amount collected — NO target shown (anchoring-bias decision) */}
        <BizSectionHeader title="Amount collected *" />
        <TextInput
          value={amount}
          onChangeText={setAmount}
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
        {amountValid ? (
          <XStack backgroundColor={COLORS.greenSoft} borderRadius={14} paddingHorizontal={13} paddingVertical={9} marginTop={8}>
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={COLORS.ledgeGreen}>
              ✓ Naka-record — itong halaga ang mapupunta sa remittance.
            </Text>
          </XStack>
        ) : null}
        <XStack gap="$1.5" marginTop={8} paddingRight={8}>
          <Lightbulb size={14} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
          <Text flex={1} fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={18}>
            I-type ang eksaktong halaga na nasa photo — ito ang ibabangga sa remittance. Walang paunang target amount na
            ipinapakita (2026-07-25 decision — iwas anchoring bias).
          </Text>
        </XStack>

        {/* Delivery receipt photo */}
        <BizSectionHeader title="Delivery Receipt" helper="· camera only" />
        <PhotoSlot
          title="Kuhanan ang delivery receipt"
          subtitle="Compressed ≤3MB · naka-save locally"
          uri={receiptPhotoUri}
          onCaptured={setReceiptPhotoUri}
        />

        {/* SMS pending banner */}
        <XStack alignItems="center" gap="$2.5" backgroundColor={BIZLINK_COLORS.amberSoft} borderRadius={20} paddingHorizontal={16} paddingVertical={13} marginTop={12}>
          <MessageSquareWarning size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
          <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange} lineHeight={17}>
            SMS confirmation sa customer — ipapadala pagka-sync. Provider/API pending — huwag i-assume.
          </Text>
        </XStack>

        {/* Remarks */}
        <BizSectionHeader title="Remarks" />
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
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

        {/* Actions */}
        <XStack gap="$2.5" marginTop={20}>
          <BizButton
            label="Reschedule"
            variant="white"
            onPress={reschedule}
            disabled={claimedByOther}
            icon={<CalendarClock size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            style={{ flex: 1 }}
          />
          <BizButton
            label="Collected"
            variant="brand"
            onPress={confirmCollect}
            disabled={!canCollect}
            icon={<Check size={17} color={BIZLINK_ON_INK.solid} strokeWidth={2} />}
            style={{ flex: 1 }}
          />
        </XStack>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={10}>
          Gagana kahit walang signal — mase-save locally, auto-sync mamaya.
        </Text>
      </ScrollView>
    </YStack>
  );
}
