import { useEffect, useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { CloudOff, KeyRound, ServerOff, Wifi, WifiOff } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';
import { getOutboxCounts, type OutboxCounts } from '../../lib/sync-engine';
import { checkConnectivity, type ConnectivityState } from '../../lib/sync/connectivity';

// T-014 Phase B (ADR-022 §5, Wireframe-Sales-BizLink.html #a-syncSheet):
// Sync Center sheet, opened from SyncStatusChip's onPress. Aggregate summary
// only — no per-record named list (that needs an outbox↔entity-name lookup
// that doesn't exist yet, out of scope per this pass) and no fake "Last
// synced" timestamp (lib/sync-engine.ts doesn't track one). The wireframe's
// "Demo: susunod" button is a design-time-only affordance, not ported.

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

function summaryText(counts: OutboxCounts): string {
  const parts: string[] = [];
  if (counts.pending > 0) parts.push(`${counts.pending} pending`);
  if (counts.failed > 0) parts.push(`${counts.failed} failed`);
  if (counts.conflict > 0) parts.push(`${counts.conflict} conflict`);
  if (parts.length === 0) return 'Naka-sync na lahat, walang naghihintay';
  return parts.join(', ');
}

interface SyncCenterSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function SyncCenterSheet({ visible, onClose }: SyncCenterSheetProps) {
  const [counts, setCounts] = useState<OutboxCounts | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityState | null>(null);

  useEffect(() => {
    if (!visible) return;
    getOutboxCounts().then(setCounts).catch(() => {});
    checkConnectivity().then(setConnectivity).catch(() => {});
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
            </YStack>

            <BizButton label="Got it" variant="brand" onPress={onClose} style={{ marginTop: 16 }} />
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
