import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AlertCircle, GitBranch, RefreshCw } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { getOutboxCounts, type OutboxCounts } from '../../lib/sync-engine';
import { getLastSyncAt } from '../../lib/sync/last-sync';

/**
 * Wireframe `.spin` (2026-08-03 spinner pass): 18dp, 3dp border, 1.1s linear
 * infinite rotation — a real animated ring, not a static icon, and only
 * while a sync is actively in flight (`counts.syncing > 0`). A plain queued
 * pending state uses the same ring with the warning-orange accent; failed /
 * conflict states keep their existing static alarm icons.
 */
function ActiveSyncSpinner({ color = BIZLINK_COLORS.navy }: { color?: string }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 3,
        borderColor: BIZLINK_COLORS.soft,
        borderTopColor: color,
        transform: [{ rotate: spin }],
      }}
    />
  );
}

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
  return n === 0 ? 'Everything is uploaded' : `${n} item${n > 1 ? 's' : ''} waiting to upload`;
}

/**
 * Batch 7a acceptance criterion: "stale/pending states are not labelled zero
 * activity." A pending count of 0 only means the local outbox is empty right
 * now — it does NOT mean the device has recently talked to the server (e.g.
 * days offline with nothing new queued locally would previously still show
 * the same "Naka-sync na lahat / Auto-uploads kapag may signal" copy as a
 * device that synced 30 seconds ago). This always renders the real
 * `getLastSyncAt()` timestamp (ADR-026 P2 item 6) as the sub-line so staleness
 * is visible regardless of the pending count.
 */
function subLine(counts: OutboxCounts, lastSyncAt: string | null): string {
  if (counts.failed > 0) return `${counts.failed} couldn't be uploaded — needs retry`;
  if (counts.conflict > 0) return `${counts.conflict} need your attention`;
  return `Last upload: ${lastSyncLabel(lastSyncAt)}`;
}

function lastSyncLabel(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'not uploaded yet';
  const elapsedMs = Date.now() - new Date(lastSyncAt).getTime();
  if (elapsedMs < 0) return 'just now';
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface SyncStatusChipProps {
  /** Pass explicit counts if the caller already has them; otherwise the chip fetches its own via getOutboxCounts() on focus. */
  counts?: OutboxCounts;
  /** Optional — reserved for the future Sync Center sheet (not built this phase). */
  onPress?: () => void;
}

export function SyncStatusChip({ counts: countsProp, onPress }: SyncStatusChipProps) {
  const [selfCounts, setSelfCounts] = useState<OutboxCounts>(EMPTY_COUNTS);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const usesOwnFetch = countsProp === undefined;

  useFocusEffect(
    useCallback(() => {
      if (usesOwnFetch) {
        getOutboxCounts().then(setSelfCounts).catch(() => {});
      }
      // Fetched regardless of `usesOwnFetch` — the last-sync-at label is
      // real device sync-history state, not tied to who owns the counts.
      getLastSyncAt().then(setLastSyncAt).catch(() => {});
    }, [usesOwnFetch])
  );

  const counts = countsProp ?? selfCounts;
  const alarm = isAlarm(counts);
  const background = alarm ? BIZLINK_COLORS.tintB : BIZLINK_COLORS.card;
  const accent = alarm ? BIZLINK_COLORS.red : BIZLINK_COLORS.navy;
  // Wireframe `.spin`: an actively-in-flight sync gets the real animated
  // ring, taking priority over the static icon — failed/conflict still win
  // visually once a sync attempt actually finishes and fails.
  const activelySyncing = counts.syncing > 0;
  // A queued outbox record is actionable local work even before the sync
  // worker starts. Keep that state visible with the same circular feedback,
  // using the warning orange accent from the BizLink palette. Failed and
  // conflict rows remain static alarm icons so their more specific state
  // continues to win visually.
  const hasPendingRecords = counts.pending > 0 && !isAlarm(counts);
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
      {alarm ? (
        <Icon size={16} color={accent} strokeWidth={1.75} />
      ) : activelySyncing ? (
        <ActiveSyncSpinner />
      ) : hasPendingRecords ? (
        <ActiveSyncSpinner color={BIZLINK_COLORS.orange} />
      ) : (
        <Icon size={16} color={accent} strokeWidth={1.75} />
      )}
      <YStack>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={accent}>
          {primaryLine(counts)}
        </Text>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.regular} color={BIZLINK_COLORS.muted}>
          {subLine(counts, lastSyncAt)}
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
