import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { History } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { getSyncHistory, type SyncHistoryEntry, type SyncHistoryOutcome } from '../../../lib/sync-history';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { StatusBadge } from '../../../components/ui/StatusBadge';

const OUTCOME_BADGES: Record<SyncHistoryOutcome, { label: string; background: string; color: string }> = {
  synced: { label: 'Synced', background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.ink },
  conflict: { label: 'Conflict', background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.orange },
  failed: { label: 'Failed', background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red },
};

function HistoryRow({ entry }: { entry: SyncHistoryEntry }) {
  const badge = OUTCOME_BADGES[entry.status];
  return (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      padding={16}
      marginBottom={10}
    >
      <YStack flex={1} gap="$0.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
          {entry.label}
        </Text>
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          {new Date(entry.occurredAt).toLocaleString()}
        </Text>
        {entry.status === 'failed' && entry.lastError ? (
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} numberOfLines={2}>
            {entry.lastError}
          </Text>
        ) : null}
      </YStack>
      <StatusBadge {...badge} />
    </XStack>
  );
}

/**
 * Manager counterpart of `app/(tabs)/more/sync-history.tsx` — reads the same
 * local `outbox` table's terminal-state rows (`lib/sync-history.ts`), which
 * is per-device data and applies identically to a manager's device.
 */
export default function ManagerSyncHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<SyncHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getSyncHistory()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sync History" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {loading && entries.length === 0 ? (
          <YStack alignItems="center" padding="$8">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : entries.length === 0 ? (
          <YStack alignItems="center" padding="$8" gap="$2.5">
            <History size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              Wala pang sync history.
            </Text>
          </YStack>
        ) : (
          entries.map((entry) => <HistoryRow key={entry.id} entry={entry} />)
        )}
      </ScrollView>
    </YStack>
  );
}
