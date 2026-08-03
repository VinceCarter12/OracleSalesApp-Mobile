import { useState } from 'react';
import { Pressable } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { FAILURE_CLASS_LABEL, type SyncHistoryEntry, type SyncHistoryOutcome } from '../../lib/sync-history';
import { StatusBadge } from '../ui/StatusBadge';

const OUTCOME_BADGES: Record<SyncHistoryOutcome, { label: string; background: string; color: string }> = {
  synced: { label: 'Synced', background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.ink },
  conflict: { label: 'Conflict', background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.orange },
  failed: { label: 'Failed', background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red },
};

const OPERATION_LABEL: Record<string, string> = {
  insert: 'Bagong record',
  update: 'Update sa record',
  delete: 'Tinanggal na record',
};

/**
 * Batch 7a: shared Sync History row for `app/(tabs)/more/sync-history.tsx`
 * and `app/(manager)/more/sync-history.tsx` (previously two near-identical
 * inline copies) — now also expandable into a detail view showing what
 * changed (operation/table), why it's pending/failed (`FailureClass`), and
 * when it was last attempted, per Batch 7a scope item 3.
 */
export function SyncHistoryRow({ entry }: { entry: SyncHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const badge = OUTCOME_BADGES[entry.status];
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <Pressable onPress={() => setExpanded((v) => !v)} style={{ minHeight: 44 }}>
      <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={16} marginBottom={10} gap="$1">
        <XStack alignItems="center" gap="$3">
          <YStack flex={1} gap="$0.5">
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
              {entry.label}
            </Text>
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {new Date(entry.occurredAt).toLocaleString()}
            </Text>
          </YStack>
          <StatusBadge {...badge} />
          <Chevron size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
        </XStack>

        {entry.status === 'failed' && entry.lastError ? (
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} numberOfLines={2}>
            {entry.lastError}
          </Text>
        ) : null}

        {expanded ? (
          <YStack marginTop={6} paddingTop={10} borderTopWidth={1} borderTopColor={BIZLINK_COLORS.line} gap="$1.5">
            <DetailLine label="Ano ang na-record" value={OPERATION_LABEL[entry.operation] ?? entry.operation} />
            {entry.status !== 'synced' ? (
              <DetailLine label="Bakit" value={entry.failureClass ? FAILURE_CLASS_LABEL[entry.failureClass] : 'Hindi pa nakumpirma'} />
            ) : null}
            <DetailLine
              label="Huling sinubukan"
              value={entry.lastAttemptAt ? new Date(entry.lastAttemptAt).toLocaleString() : 'Wala pang attempt na naitala'}
            />
            {entry.retryCount > 0 ? <DetailLine label="Bilang ng retry" value={String(entry.retryCount)} /> : null}
            <DetailLine label="Ginawa noong" value={new Date(entry.createdAt).toLocaleString()} />
            {entry.createdOnline !== null ? (
              <DetailLine label="Ginawa habang" value={entry.createdOnline ? 'Online' : 'Offline'} />
            ) : null}
            {entry.adminMessage ? <DetailLine label="Susunod na hakbang" value={entry.adminMessage} /> : null}
          </YStack>
        ) : null}
      </YStack>
    </Pressable>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <XStack gap="$2" alignItems="flex-start">
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted} width={110}>
        {label}
      </Text>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} flex={1}>
        {value}
      </Text>
    </XStack>
  );
}
