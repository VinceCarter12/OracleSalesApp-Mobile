import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AlertCircle, GitBranch, RefreshCw } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { getOutboxCounts, type OutboxCounts } from '../../lib/sync-engine';

// T-014 Phase 1 (ADR-024 Phase 1 shared foundation): BizLink-styled
// extraction of the sync chip that previously lived inline in
// app/(tabs)/index.tsx (~lines 191-216, pre-migration). Same worst-state-wins
// logic and Tagalog copy as before — this is a restyle, not new behavior.
// Sync Center sheet (tap-to-open) is a separate Phase B UI surface, not built
// yet — the chip renders inert (no onPress) unless a caller supplies one.

const EMPTY_COUNTS: OutboxCounts = { pending: 0, syncing: 0, conflict: 0, failed: 0, synced: 0 };

/**
 * Matches the original inline chip's math exactly (app/(tabs)/index.tsx,
 * pre-Phase-1): `syncing` is deliberately excluded from both the alarm
 * check and the displayed count — only failed/conflict trigger the alarm
 * styling, and the "N pending" number is pending+failed+conflict only.
 */
function pendingSyncCount(counts: OutboxCounts): number {
  return counts.pending + counts.failed + counts.conflict;
}

function isAlarm(counts: OutboxCounts): boolean {
  return counts.failed > 0 || counts.conflict > 0;
}

function primaryLine(counts: OutboxCounts): string {
  const n = pendingSyncCount(counts);
  return n === 0 ? 'Naka-sync na lahat' : `${n} record${n > 1 ? 's' : ''} pending sync`;
}

function subLine(counts: OutboxCounts): string {
  if (counts.failed > 0) return `${counts.failed} failed — kailangan i-retry`;
  if (counts.conflict > 0) return `${counts.conflict} may conflict`;
  return 'Auto-uploads kapag may signal';
}

interface SyncStatusChipProps {
  /** Pass explicit counts if the caller already has them; otherwise the chip fetches its own via getOutboxCounts() on focus. */
  counts?: OutboxCounts;
  /** Optional — reserved for the future Sync Center sheet (not built this phase). */
  onPress?: () => void;
}

export function SyncStatusChip({ counts: countsProp, onPress }: SyncStatusChipProps) {
  const [selfCounts, setSelfCounts] = useState<OutboxCounts>(EMPTY_COUNTS);
  const usesOwnFetch = countsProp === undefined;

  useFocusEffect(
    useCallback(() => {
      if (!usesOwnFetch) return;
      getOutboxCounts().then(setSelfCounts).catch(() => {});
    }, [usesOwnFetch])
  );

  const counts = countsProp ?? selfCounts;
  const alarm = isAlarm(counts);
  const background = alarm ? BIZLINK_COLORS.tintB : BIZLINK_COLORS.card;
  const accent = alarm ? BIZLINK_COLORS.red : BIZLINK_COLORS.navy;
  const Icon = counts.failed > 0 ? AlertCircle : counts.conflict > 0 ? GitBranch : RefreshCw;

  const content = (
    <XStack
      alignItems="center"
      gap="$2.5"
      backgroundColor={background}
      borderRadius={999}
      paddingHorizontal={16}
      paddingVertical={11}
      marginTop={12}
    >
      <Icon size={16} color={accent} strokeWidth={1.75} />
      <YStack>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={accent}>
          {primaryLine(counts)}
        </Text>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.regular} color={BIZLINK_COLORS.muted}>
          {subLine(counts)}
        </Text>
      </YStack>
    </XStack>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{ minHeight: 44 }}>
      {content}
    </Pressable>
  );
}
