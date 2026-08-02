import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { History } from 'lucide-react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { getSyncHistory, type SyncHistoryEntry } from '../../../lib/sync-history';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { SyncHistoryRow } from '../../../components/sync/SyncHistoryRow';

/**
 * Wireframe `id="a-synchistory"` (`aRenderSyncHistory()`, ~line 1814) —
 * "Ano ang na-sync, kailan." Real `sync_audit_log` (Sprint.md T-016) is
 * remote-only and not yet applied to Supabase (see lib/sync/audit-log.ts),
 * so this reads the local `outbox` table's own terminal-state rows instead
 * (lib/sync-history.ts) — a genuinely real, never-pruned local record of
 * synced/conflict/failed outcomes, not mock data.
 */
export default function SyncHistoryScreen() {
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
      <BizTopBar title="Sync History" fallbackHref="/(tabs)/more" />
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
          entries.map((entry) => <SyncHistoryRow key={entry.id} entry={entry} />)
        )}
      </ScrollView>
    </YStack>
  );
}
