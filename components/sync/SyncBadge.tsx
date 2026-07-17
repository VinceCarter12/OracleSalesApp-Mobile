import { AlertCircle, Clock, GitBranch, RefreshCw } from 'lucide-react-native';
import { View } from 'tamagui';
import { BIZLINK_COLORS } from '../../lib/theme';
import type { OutboxStatus } from '../../lib/sync/outbox-status';

// T-014 Phase 1 (ADR-024): per-record sync-state pill for list rows
// (clients/meetings). "Absence = synced" per Design-System-Catalog §3 —
// renders nothing once a record is synced, so lists don't get cluttered with
// a badge on every row.

interface SyncBadgeProps {
  status: OutboxStatus;
}

export function SyncBadge({ status }: SyncBadgeProps) {
  if (status === 'synced') return null;

  const isAlarm = status === 'conflict' || status === 'failed';
  const background = isAlarm ? BIZLINK_COLORS.tintB : BIZLINK_COLORS.soft;
  const color = isAlarm ? BIZLINK_COLORS.red : BIZLINK_COLORS.navy;
  const Icon = status === 'failed' ? AlertCircle : status === 'conflict' ? GitBranch : status === 'syncing' ? RefreshCw : Clock;

  return (
    <View
      backgroundColor={background}
      borderRadius={999}
      width={22}
      height={22}
      alignItems="center"
      justifyContent="center"
    >
      <Icon size={13} color={color} strokeWidth={1.75} />
    </View>
  );
}
