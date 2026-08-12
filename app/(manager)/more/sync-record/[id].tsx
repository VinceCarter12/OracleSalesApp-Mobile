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
 * Manager counterpart of `app/(tabs)/more/sync-record/[id].tsx`. Wireframe
 * `id="sync-history-detail"` / `openSyncHistoryDetail()` in
 * `Wireframe-Manager-BizLink.html` — a simpler record view than Sales'
 * (only Result/Completed, no Type/Local record/Included) plus a
 * Manager-specific device-scoped notice message, per that wireframe.
 */
export default function ManagerSyncRecordDetailScreen() {
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
        <BizTopBar title="Sync Record" fallbackHref="/(manager)/more/sync-history" />
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            This sync record can't be found.
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sync Record" fallbackHref="/(manager)/more/sync-history" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <SyncRecordDetail
          entry={entry}
          showFullFields={false}
          noticeText="These are only this manager device's records — not a team-wide audit log."
        />
      </ScrollView>
    </YStack>
  );
}
