import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  CalendarClock,
  Check,
  FileCheck,
  FileText,
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
import { SignaturePad, type SignaturePadHandle } from '../../components/collection-delivery/SignaturePad';
import { formatCapturedTimestamp, formatPeso, isOpenForCollection, remainingBalance, type PaymentMethod } from '../../lib/collection-delivery-data';
import { useNow } from '../../lib/use-now';
import { claimStop, collectPayment, markAdditionalSeen, releaseStop, rescheduleVisit } from '../../lib/collection-delivery-write';
import { runSync } from '../../lib/sync-engine';
import { useCollectionStore } from '../../lib/use-collection-delivery';

/**
 * F-007 Collect Payment — wireframe `c-visit`. Opened from a pending row in
 * Today's List. Auto-captures GPS + timestamp, takes a payment-method +
 * payment photo + amount + delivery-receipt photo, then marks the store
 * collected. The "✓ Collected" button unlocks only when amount > 0 AND both
 * photos are captured (wireframe cCheckCollectForm). The collect WRITE goes
 * through collection-delivery-write.ts (local update + outbox push); both
 * captured photos ride the shared pending_uploads lane (Phase 2b).
 *
 * Amount entry deliberately shows NO target/expected amount (2026-07-25
 * anchoring-bias decision) — the collector types the actual amount received.
 */

// PayMode is exactly the (lowercase) PaymentMethod union — 'counter' is a real
// stored value now (2026-07-26 / web 043), not folded into 'cash'.
type PayMode = PaymentMethod;

const PAY_LABELS: Record<PayMode, string> = {
  cash: 'Take a photo of the cash',
  check: 'Take a photo of the check',
  gcash: 'Take a photo of the GCash confirmation screen',
  counter: 'Take a photo of the counter receipt',
  delivery_receipt: 'Take a photo of the delivery receipt',
};

// Amount collected is only entered for cash/check/gcash. For counter and
// delivery-receipt payments no cash changes hands here, so no amount is typed.
const METHODS_WITH_AMOUNT: PayMode[] = ['cash', 'check', 'gcash'];

/**
 * Formats a raw amount entry with thousands separators as the collector types
 * (e.g. "10000" → "10,000"), so a five-figure amount is unmistakable from a
 * four-figure one. Keeps up to 2 decimals; strips anything else. The parse in
 * the component already ignores separators, so the stored value stays numeric.
 */
function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (cleaned === '') return '';
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) {
    return Number(cleaned).toLocaleString('en-US');
  }
  const intPart = cleaned.slice(0, firstDot).replace(/\./g, '');
  const decPart = cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  const intFormatted = intPart === '' ? '0' : Number(intPart).toLocaleString('en-US');
  return `${intFormatted}.${decPart}`;
}

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
  const { profileId, fullName, teamId } = useSession();
  // Real record from the local mirror for display; the collect/reschedule/claim
  // WRITE goes through collection-delivery-write.ts (local update + outbox push).
  const { store, loading, refresh } = useCollectionStore(storeId);

  // F-007 Additional Collection (web 068/069): opening an additional store's
  // screen IS the "Viewed" signal. Flag the seen-intent once the row is loaded;
  // the ack reconciler stamps it server-side (collector-only RPC) on the next
  // online pass. Guarded + idempotent in the DB, so re-runs are harmless.
  useEffect(() => {
    if (!profileId || !store?.isAdditional || store.additionalSeenAt) return;
    markAdditionalSeen(db, storeId, profileId).catch(() => {});
  }, [db, storeId, profileId, store?.isAdditional, store?.additionalSeenAt]);

  const [payMode, setPayMode] = useState<PayMode>('cash');
  const [payPhotoUri, setPayPhotoUri] = useState<string | null>(null);
  const [receiptPhotoUri, setReceiptPhotoUri] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  // Flips true once the collector leaves the amount field — an early trigger
  // for the red "required" styling before they even tap Collected.
  const [amountTouched, setAmountTouched] = useState(false);
  // Flips true when the collector taps Collected while something required is
  // still missing — reveals the red state on EVERY skipped field at once.
  const [attempted, setAttempted] = useState(false);
  const [remarks, setRemarks] = useState('');
  // Customer acknowledgment signature — captured for every payment method.
  const [signed, setSigned] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const sigRef = useRef<SignaturePadHandle>(null);
  // GPS captured at the moment the payment photo is taken (web rule: the fix
  // rides with the photo). Null = "no pin" — never synthesized.
  const [gps, setGps] = useState<GpsFix | null>(null);
  // Live wall-clock preview for the Auto-captured card — the real timestamp is
  // stamped at submit (collectPayment uses its own `now`); this just shows the
  // collector the current date/time instead of a frozen literal.
  const nowIso = useNow();

  const showAmount = METHODS_WITH_AMOUNT.includes(payMode);
  // Delivery-receipt payments are the delivery receipt itself — just the one
  // photo + remarks, no separate receipt slot.
  const isDeliveryReceipt = payMode === 'delivery_receipt';
  // The separate delivery-receipt photo is only for cash/check/gcash. Counter
  // takes no receipt slot, and delivery-receipt is its own receipt already.
  const showReceiptPhoto = payMode !== 'counter' && !isDeliveryReceipt;
  const amountValue = parseFloat((amount || '').replace(/[^\d.]/g, ''));
  const amountValid = amountValue > 0;
  const claimedByMe = !!store?.claimedById && store.claimedById === profileId;
  const claimedByOther = !!store?.claimedById && !claimedByMe;
  const canCollect =
    !!payPhotoUri &&
    signed &&
    (showAmount ? amountValid : true) &&
    (showReceiptPhoto ? !!receiptPhotoUri : true) &&
    !claimedByOther;

  // Red "required" flags. Amount lights up on blur (early) or on a submit
  // attempt; the photo/receipt/signature light up on a submit attempt (they
  // have no blur event). A captured/valid field never shows red.
  const showAmountError = showAmount && !amountValid && (amountTouched || attempted);
  const showPayPhotoError = attempted && !payPhotoUri;
  const showReceiptError = attempted && showReceiptPhoto && !receiptPhotoUri;
  const showSignError = attempted && !signed;
  // Remaining balance still owed on this store (web 070): original due minus
  // what's already been paid across prior partial payments. This is what a new
  // payment draws down, and what the over-payment check compares against.
  const remaining = store ? remainingBalance(store) : 0;
  const isPartial = store?.status === 'partial';
  // Soft over-payment check: a valid amount above the remaining BALANCE is still
  // ALLOWED (real overpayments happen) — just flagged so a typo gets a second
  // look. Only when a real balance exists (>0).
  const overDue = showAmount && amountValid && remaining > 0 && amountValue > remaining;

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
    // A claim rides the outbox and can be REJECTED at flush by the server's
    // one-active-claim rule (23505, `collection_visits_one_active_claim`):
    // someone beat us to this stop, or we already hold a different one. On
    // rejection the row snaps back to pending (server-wins), so await a pass
    // when online and tell the collector why — a silent revert reads as "claim
    // is broken". Offline, the optimistic claim stands until the next flush.
    const result = await runSync(profileId, teamId);
    if (result?.connectivity !== 'online') return;
    const row = await db.getFirstAsync<{ claimed_by: string | null }>(
      'SELECT claimed_by FROM collection_visits WHERE id = ?',
      [storeId],
    );
    if (row && row.claimed_by !== profileId) {
      Alert.alert(
        'Claim didn’t stick',
        'Another collector already took this stop, or you’re still holding a different one. Finish or release your current stop before claiming a new one.',
      );
    }
  }

  async function release(): Promise<void> {
    if (!profileId) return;
    await releaseStop(db, 'collection_visits', storeId, profileId);
    refresh();
  }

  async function confirmCollect(): Promise<void> {
    if (!profileId) return;
    // Tapped with something required still missing — reveal the red flags and
    // stop, instead of silently doing nothing.
    if (!canCollect) {
      setAttempted(true);
      return;
    }
    // The payment-photo capture kicks off a GPS read, but the collector may tap
    // Collected before it resolves (or it may have failed) — make one solid
    // attempt here so a completed collection isn't saved with a null pin.
    let fix = gps;
    if (!fix) {
      try {
        fix = await captureGps();
      } catch {
        // No fix available (offline / indoors / denied) → save without a pin.
      }
    }
    // Render the customer signature to a JPEG so it's ready to upload once the
    // collection_payments signature column exists (see collectPayment).
    const signatureUri = (await sigRef.current?.captureToFile()) ?? undefined;
    // cash/check/gcash = the typed amount (may be partial). counter/delivery-
    // receipt aren't cash to the collector — they settle the whole remaining
    // balance in one go (and the payments table's CHECK requires amount > 0, so
    // 0 is never valid). `remaining` falls back to the due for a fresh store.
    const paidAmount = showAmount ? amountValue : Math.max(remaining, 0);
    // Fully settles the balance? → celebrate. A partial payment goes back to the
    // list, which now shows the store as Partial with its reduced balance.
    const settlesFull = paidAmount >= remaining;
    await collectPayment(db, storeId, profileId, {
      method: payMode,
      amount: paidAmount,
      gps: fix ?? undefined,
      remarks,
      paymentPhotoUri: payPhotoUri ?? undefined,
      receiptPhotoUri: showReceiptPhoto ? receiptPhotoUri ?? undefined : undefined,
      signatureUri,
    });
    if (settlesFull) {
      router.replace('/(collection)/celebrate');
    } else {
      router.back();
    }
  }

  function reschedule(): void {
    Alert.alert(
      'Reschedule visit',
      `${store?.name ?? 'Store'} — won’t make it there today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reschedule to tomorrow',
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
            {loading ? 'Loading…' : 'This store could not be found.'}
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Collect Payment" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} scrollEnabled={scrollEnabled}>
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

        {/* Claim / "On the way" — hard lock (web 046). Also shown for a partial
            store, which is still open for a follow-up collection. */}
        {isOpenForCollection(store.status) ? (
          claimedByOther ? (
            <XStack alignItems="center" gap="$2.5" backgroundColor={BIZLINK_COLORS.tintB} borderRadius={16} paddingHorizontal={14} paddingVertical={12} marginTop={10}>
              <Lock size={16} color={COLORS.ledgeRed} strokeWidth={1.75} />
              <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={COLORS.ledgeRed} lineHeight={16}>
                {store.claimedBy} is on the way — you can’t take this one.
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

        {/* Auto-captured (dark card) */}
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={0.5} color={BIZLINK_COLORS.muted} marginTop={16} marginBottom={6}>
          AUTO-CAPTURED
        </Text>
        <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16} gap="$1.5">
          <XStack alignItems="center" gap="$2">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={gps ? '#8FD7B4' : BIZLINK_ON_INK.textMuted}>{gps ? '✓' : '…'}</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.solid}>GPS pinpoint</Text>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
              {gps ? `${gps.lat.toFixed(4)}° N, ${gps.lng.toFixed(4)}° E` : 'captured with the payment photo'}
            </Text>
          </XStack>
          <XStack alignItems="center" gap="$2">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color="#8FD7B4">✓</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.solid}>Date &amp; time</Text>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>{formatCapturedTimestamp(nowIso)}</Text>
          </XStack>
        </YStack>

        {/* Payment method */}
        <BizSectionHeader title="Payment method" />
        <XStack gap="$2" flexWrap="wrap">
          <PayTile icon={<Banknote size={14} color={iconColor('cash')} strokeWidth={1.75} />} label="Cash" selected={payMode === 'cash'} onPress={() => setPayMode('cash')} />
          <PayTile icon={<FileCheck size={14} color={iconColor('check')} strokeWidth={1.75} />} label="Check" selected={payMode === 'check'} onPress={() => setPayMode('check')} />
          <PayTile icon={<Smartphone size={14} color={iconColor('gcash')} strokeWidth={1.75} />} label="GCash" selected={payMode === 'gcash'} onPress={() => setPayMode('gcash')} />
          <PayTile icon={<Receipt size={14} color={iconColor('counter')} strokeWidth={1.75} />} label="Counter" selected={payMode === 'counter'} onPress={() => setPayMode('counter')} />
          <PayTile icon={<FileText size={14} color={iconColor('delivery_receipt')} strokeWidth={1.75} />} label="Delivery Receipt" selected={payMode === 'delivery_receipt'} onPress={() => setPayMode('delivery_receipt')} />
        </XStack>

        {/* Payment photo */}
        <BizSectionHeader title="Payment photo" helper="· camera only" />
        <PhotoSlot
          title={PAY_LABELS[payMode]}
          subtitle="Compressed ≤3MB · saved on your phone"
          uri={payPhotoUri}
          onCaptured={onPayPhoto}
          error={showPayPhotoError}
        />
        {showPayPhotoError ? (
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={COLORS.ledgeRed} marginTop={6}>
            A payment photo is required.
          </Text>
        ) : null}

        {/* Amount collected — only for cash/check/gcash. Counter and delivery
            receipt take no amount here (no cash handed over on the spot). */}
        {showAmount ? (
          <>
            <BizSectionHeader title="Amount collected *" />
            {/* Due surfaced right by the input (2026-08-08, per request) so the
                collector can compare what's owed to what they're entering,
                without going back to the dashboard. */}
            <YStack backgroundColor={BIZLINK_COLORS.tintA} borderRadius={14} paddingHorizontal={14} paddingVertical={10} marginBottom={8}>
              <XStack alignItems="center" justifyContent="space-between">
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  {isPartial ? 'Balance still due' : 'Amount due'}
                </Text>
                <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>{formatPeso(remaining)}</Text>
              </XStack>
              {isPartial ? (
                <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={3}>
                  Already paid {formatPeso(store.amountCollected ?? 0)} of {formatPeso(store.due)}
                </Text>
              ) : null}
            </YStack>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(formatAmountInput(t))}
              onBlur={() => setAmountTouched(true)}
              keyboardType="numeric"
              placeholder="₱ 0.00"
              placeholderTextColor={BIZLINK_COLORS.muted}
              style={{
                height: 52,
                borderRadius: 16,
                paddingHorizontal: 16,
                backgroundColor: BIZLINK_COLORS.card,
                borderWidth: showAmountError ? 1.5 : 0,
                borderColor: showAmountError ? COLORS.ledgeRed : 'transparent',
                fontFamily: BIZLINK_FONTS.semibold,
                fontSize: 20,
                letterSpacing: -0.5,
                color: BIZLINK_COLORS.text,
              }}
            />
            {showAmountError ? (
              <XStack backgroundColor={COLORS.redSoft} borderRadius={14} paddingHorizontal={13} paddingVertical={9} marginTop={8}>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={COLORS.ledgeRed}>
                  Enter the amount collected — this field is required.
                </Text>
              </XStack>
            ) : overDue ? (
              <XStack backgroundColor={COLORS.amberSoft} borderRadius={14} paddingHorizontal={13} paddingVertical={9} marginTop={8}>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={COLORS.orange}>
                  This is more than the {formatPeso(remaining)} balance — double-check the amount. You can still proceed.
                </Text>
              </XStack>
            ) : amountValid ? (
              <XStack backgroundColor={COLORS.greenSoft} borderRadius={14} paddingHorizontal={13} paddingVertical={9} marginTop={8}>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={COLORS.ledgeGreen}>
                  ✓ Recorded — this amount will go to the remittance.
                </Text>
              </XStack>
            ) : null}
            <XStack gap="$1.5" marginTop={8} paddingRight={8}>
              <Lightbulb size={14} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
              <Text flex={1} fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={18}>
                Type the exact amount shown in the photo — this is what gets matched against the remittance. No target
                amount is shown ahead of time, so you enter what was actually received.
              </Text>
            </XStack>
          </>
        ) : null}

        {/* Delivery receipt photo — only for cash/check/gcash. Counter takes no
            receipt, and the delivery-receipt method's own photo IS the receipt. */}
        {showReceiptPhoto ? (
          <>
            <BizSectionHeader title="Delivery Receipt" helper="· camera only" />
            <PhotoSlot
              title="Take a photo of the delivery receipt"
              subtitle="Compressed ≤3MB · saved on your phone"
              uri={receiptPhotoUri}
              onCaptured={setReceiptPhotoUri}
              error={showReceiptError}
            />
            {showReceiptError ? (
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={COLORS.ledgeRed} marginTop={6}>
                A delivery-receipt photo is required.
              </Text>
            ) : null}
          </>
        ) : null}

        {/* SMS pending banner */}
        <XStack alignItems="center" gap="$2.5" backgroundColor={BIZLINK_COLORS.amberSoft} borderRadius={20} paddingHorizontal={16} paddingVertical={13} marginTop={12}>
          <MessageSquareWarning size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
          <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange} lineHeight={17}>
            SMS confirmation to the customer — sent once synced. Provider/API still pending, so don’t rely on it yet.
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

        {/* Customer signature — required for every payment method. */}
        <BizSectionHeader title="Customer signature" helper="· sign on the phone" />
        <SignaturePad
          ref={sigRef}
          onSignedChange={setSigned}
          onDrawingChange={(d) => setScrollEnabled(!d)}
          hint="Have the customer sign here"
        />
        {showSignError ? (
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={COLORS.ledgeRed} marginTop={6}>
            A customer signature is required.
          </Text>
        ) : null}

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
            label="Record payment"
            variant="brand"
            onPress={confirmCollect}
            // Tappable when incomplete so confirmCollect can flag the missing
            // fields; only the "someone else is on the way" lock disables it.
            disabled={claimedByOther}
            icon={<Check size={17} color={BIZLINK_ON_INK.solid} strokeWidth={2} />}
            style={{ flex: 1 }}
          />
        </XStack>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={10}>
          Works even without signal — saved on your phone and synced automatically later.
        </Text>
      </ScrollView>
    </YStack>
  );
}
