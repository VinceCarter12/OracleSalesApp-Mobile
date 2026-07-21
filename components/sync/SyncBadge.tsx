import { AlertCircle, Clock, GitBranch, RefreshCw } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { OutboxStatus } from '../../lib/sync/outbox-status';

// T-014 Phase 1 (ADR-024), rewritten 2026-07-21 to match Wireframe-Sales-
// BizLink.html's `syncBadge()` JS function exactly — that renders an icon +
// TEXT LABEL pill ("Pending sync", "Nag-a-upload…", "May conflict", "Failed
// — i-retry"), not an icon-only circle. The original icon-only shape was an
// unauthorized drift from the wireframe (ADR-010 gate), caught during
// device review. "Absence = synced" per Design-System-Catalog §3 — renders
// nothing once a record is synced, so lists don't get cluttered with a
// badge on every row.

interface SyncBadgeProps {
  status: OutboxStatus;
}

const SYNC_BADGE_CONTENT: Record<Exclude<OutboxStatus, 'synced'>, { label: string; Icon: typeof Clock }> = {
  pending: { label: 'Pending sync', Icon: Clock },
  syncing: { label: 'Nag-a-upload…', Icon: RefreshCw },
  conflict: { label: 'May conflict', Icon: GitBranch },
  failed: { label: 'Failed — i-retry', Icon: AlertCircle },
};

export function SyncBadge({ status }: SyncBadgeProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  if (status === 'synced') return null;

  const isAlarm = status === 'conflict' || status === 'failed';
  const background = isAlarm ? BIZLINK_COLORS.tintB : BIZLINK_COLORS.tintA;
  const color = isAlarm ? BIZLINK_COLORS.red : BIZLINK_COLORS.navy;
  const { label, Icon } = SYNC_BADGE_CONTENT[status];

  return (
    <XStack
      alignItems="center"
      gap="$1"
      backgroundColor={background}
      borderRadius={999}
      paddingHorizontal={9}
      paddingVertical={4}
    >
      <Icon size={11} color={color} strokeWidth={1.75} />
      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={color}>{label}</Text>
    </XStack>
  );
}
