import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import { AlertTriangle, CloudOff, GitBranch, KeyRound, RefreshCw, ServerOff, Wifi, WifiOff } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';
import { getOutboxCounts, retryAllFailedOutboxRows, type OutboxCounts } from '../../lib/sync-engine';
import { checkConnectivity, type ConnectivityState } from '../../lib/sync/connectivity';
import { getPendingSyncEntries, type PendingSyncEntry } from '../../lib/sync-history';
import { useSession } from '../../lib/session-store';

// T-014 Phase B (ADR-022 §5, Wireframe-Sales-BizLink.html #a-syncSheet):
// Sync Center sheet, opened from SyncStatusChip's onPress. No fake "Last
// synced" timestamp (lib/sync-engine.ts doesn't track one). The wireframe's
// "Demo: susunod" button is a design-time-only affordance, not ported.
//
// B-024: originally aggregate-count-only ("12 pending", no names) — a
// record created offline was invisible here beyond a number. Now also lists
// each pending/failed/conflict row by its real label via
// lib/sync-history.ts::getPendingSyncEntries().

const ENTRY_STATUS_ICON: Record<PendingSyncEntry['status'], typeof RefreshCw> = {
  pending: RefreshCw,
  syncing: RefreshCw,
  failed: AlertTriangle,
  conflict: GitBranch,
  synced: RefreshCw,
};

/**
 * B-027: "current state" — a `pending` row's real situation depends on the
 * device's CURRENT connectivity (not connectivity at creation time): still
 * genuinely waiting for a signal, or online now and about to be picked up
 * by the next sync pass. `failed`/`conflict` get their own fixed copy since
 * those don't resolve just by coming online.
 */
function currentStateLabel(status: PendingSyncEntry['status'], isOnline: boolean): string {
  if (status === 'failed') return 'Kailangan ng manual retry';
  if (status === 'conflict') return 'May conflict — hihintayin ang admin';
  if (status === 'syncing') return 'Sina-sync ngayon…';
  return isOnline ? 'Online — susunod na i-sync' : 'Offline pa rin — naghihintay';
}

function PendingEntryRow({ entry, isOnline }: { entry: PendingSyncEntry; isOnline: boolean }) {
  const Icon = ENTRY_STATUS_ICON[entry.status];
  const color = entry.status === 'failed' ? BIZLINK_COLORS.red : entry.status === 'conflict' ? BIZLINK_COLORS.orange : BIZLINK_COLORS.muted;
  return (
    <YStack gap="$0.5" paddingVertical={9}>
      <XStack alignItems="center" gap="$2.5">
        <Icon size={14} color={color} strokeWidth={1.75} />
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} flex={1} numberOfLines={1}>
          {entry.label}
        </Text>
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={color}>
          {currentStateLabel(entry.status, isOnline)}
        </Text>
      </XStack>
      {entry.adminMessage ? (
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange} marginLeft={22}>
          {entry.adminMessage}
        </Text>
      ) : null}
    </YStack>
  );
}

const CONNECTIVITY_COPY: Partial<
  Record<ConnectivityState, { icon: typeof WifiOff; background: string; color: string; text: string }>
> = {
  offline: { icon: WifiOff, background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.muted, text: 'Offline — saved sa device' },
  no_internet: { icon: CloudOff, background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.muted, text: 'May signal, walang internet' },
  backend_unreachable: { icon: ServerOff, background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.navy, text: 'Hindi maabot ang server — susubukan ulit' },
  auth_required: { icon: KeyRound, background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red, text: 'Mag-sign in ulit para mag-sync' },
};

function ConnectivityPill({ state }: { state: ConnectivityState | null }) {
  const copy = state ? CONNECTIVITY_COPY[state] : undefined;
  const { icon: Icon, background, color, text } = copy ?? {
    icon: Wifi,
    background: BIZLINK_COLORS.tintA,
    color: BIZLINK_COLORS.navy,
    text: 'Online',
  };
  return (
    <XStack
      alignItems="center"
      gap="$2"
      backgroundColor={background}
      borderRadius={999}
      paddingHorizontal={14}
      paddingVertical={8}
      alignSelf="flex-start"
      marginTop={8}
    >
      <Icon size={14} color={color} strokeWidth={1.75} />
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={color}>{text}</Text>
    </XStack>
  );
}

/**
 * ADR-026 P3 item 12 — mirrors `aSyncSummaryText()`/`syncSummaryText()` in
 * Wireframe-Sales-BizLink.html / Wireframe-Manager-BizLink.html exactly:
 * severity-first ordering (conflict, failed, pending) so the overflow hint
 * can only ever hide non-issue pending items, never a real problem; overflow
 * (", at N pa") triggers only when all three categories are nonempty.
 * `syncing` has no separate wireframe category — it folds into "naghihintay"
 * alongside `pending` (Vince-confirmed 2026-07-19).
 */
function summaryText(counts: OutboxCounts): string {
  const pendingTotal = counts.pending + counts.syncing;
  if (counts.conflict === 0 && counts.failed === 0 && pendingTotal === 0) {
    return 'Naka-sync na lahat, walang naghihintay';
  }
  const nonempty: string[] = [];
  if (counts.conflict > 0) nonempty.push(`${counts.conflict} may salungatan`);
  if (counts.failed > 0) nonempty.push(`${counts.failed} nabigo`);
  if (pendingTotal > 0) nonempty.push(`${pendingTotal} naghihintay`);
  if (nonempty.length <= 2) return nonempty.join(', ');
  return `${nonempty.slice(0, -1).join(', ')}, at ${pendingTotal} pa`;
}

interface SyncCenterSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function SyncCenterSheet({ visible, onClose }: SyncCenterSheetProps) {
  const { profileId } = useSession();
  const [counts, setCounts] = useState<OutboxCounts | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityState | null>(null);
  const [entries, setEntries] = useState<PendingSyncEntry[]>([]);
  const [retrying, setRetrying] = useState(false);

  const refresh = () => {
    getOutboxCounts().then(setCounts).catch(() => {});
    checkConnectivity().then(setConnectivity).catch(() => {});
    getPendingSyncEntries().then(setEntries).catch(() => {});
  };

  useEffect(() => {
    if (!visible) return;
    refresh();
  }, [visible]);

  // B-023: `retryFailedOutboxRow` existed since ADR-018 but had no UI ever
  // calling it — failed records never left "failed" (not even auto-retried
  // on reconnect, by design) until an agent manually triggers this.
  async function handleRetryAll(): Promise<void> {
    if (!profileId) return;
    setRetrying(true);
    try {
      await retryAllFailedOutboxRows(profileId);
      refresh();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <YStack
            backgroundColor={BIZLINK_COLORS.canvas}
            borderTopLeftRadius={28}
            borderTopRightRadius={28}
            padding={18}
            paddingBottom={28}
          >
            <XStack justifyContent="center" marginBottom={12}>
              <YStack width={40} height={4} borderRadius={2} backgroundColor={BIZLINK_COLORS.line} />
            </XStack>

            <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
              Sync Center
            </Text>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={4}>
              Offline-first: naka-save na sa phone mo lahat. Kusang aakyat sa server pag may signal.
            </Text>

            <ConnectivityPill state={connectivity} />

            <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={16} marginTop={12}>
              <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                {counts ? summaryText(counts) : 'Kinukuha ang status…'}
              </Text>
              {entries.length > 0 ? (
                <ScrollView style={{ maxHeight: 180, marginTop: 8 }} showsVerticalScrollIndicator={false}>
                  {entries.map((entry, index) => (
                    <YStack
                      key={entry.id}
                      borderTopWidth={index === 0 ? 0 : 1}
                      borderTopColor={BIZLINK_COLORS.line}
                    >
                      <PendingEntryRow entry={entry} isOnline={connectivity === 'online'} />
                    </YStack>
                  ))}
                </ScrollView>
              ) : null}
            </YStack>

            {counts && counts.failed > 0 ? (
              <BizButton
                label={retrying ? 'Ni-retry…' : `Retry lahat (${counts.failed})`}
                variant="white"
                onPress={handleRetryAll}
                disabled={retrying}
                icon={retrying ? <Spinner color={BIZLINK_COLORS.text} /> : undefined}
                style={{ marginTop: 12 }}
              />
            ) : null}

            <BizButton label="Got it" variant="brand" onPress={onClose} style={{ marginTop: 8 }} />
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
