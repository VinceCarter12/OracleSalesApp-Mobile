import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../../lib/theme';
import { getSyncHistory, type SyncHistoryEntry } from '../../../../lib/sync-history';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { SyncRecordDetail } from '../../../../components/sync/SyncRecordDetail';

/**
 * Wireframe `id="a-synchistorydetail"` (`aOpenSyncHistoryDetail()`) — full
 * record information (Type/Local record/Included/Result/Completed) and the
 * device-scoped history notice. Body shared with the Manager equivalent via
 * `components/sync/SyncRecordDetail.tsx` (Batch 2026-08-08).
 */
export default function SyncRecordDetailScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<SyncHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await getSyncHistory(200); // Load more to find specific entry
      const found = entries.find((e) => e.id === id);
      setEntry(found ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top} justifyContent="center" alignItems="center">
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (!entry) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Sync Record" fallbackHref="/(tabs)/more/sync-history" />
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            Hindi makita ang sync record na ito.
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sync Record" fallbackHref="/(tabs)/more/sync-history" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <SyncRecordDetail
          entry={entry}
          showFullFields
          noticeText="Impormasyon ng sariling record ng Sales user. Hindi ito admin-wide audit log."
        />
      </ScrollView>
    </YStack>
  );
}
