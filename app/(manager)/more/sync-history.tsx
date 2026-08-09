import { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { YStack } from 'tamagui';
import { useBizlinkColors } from '../../../lib/theme';
import { useSyncHistory } from '../../../lib/use-sync-history';
import { PAGINATION_PAGE_SIZE } from '../../../lib/use-pagination';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { SyncHistoryList } from '../../../components/sync/SyncHistoryList';

/**
 * Manager counterpart of `app/(tabs)/more/sync-history.tsx` — reads the same
 * local `outbox` table's terminal-state rows (`lib/sync-history.ts`), which
 * is per-device data and applies identically to a manager's device.
 *
 * Wireframe `id="sync-history"` in `Wireframe-Manager-BizLink.html`, marked
 * "SHARED SYNC HISTORY PATTERN (own-device only)" — same numbered-list/
 * search/filter-chip/tap-to-detail pattern as Sales, via
 * `components/sync/SyncHistoryList.tsx` (Batch 2026-08-08: previously this
 * screen rendered an inline-expand `SyncHistoryRow` accordion instead of
 * navigating to a detail screen, which did not match the wireframe).
 * Pagination state lives in `lib/use-sync-history.ts` (Batch 2026-08-09).
 */
export default function ManagerSyncHistoryScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { loading, reload, search, onSearchChange, outcomeFilter, onFilterChange, entries, pageItems, page, totalPages, setPage } = useSyncHistory();

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sync History" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        <SyncHistoryList
          description="Listahan ng mga na-sync (o na-flag) na pagbabagong ginawa mo sa device na ito — hindi kasama ang sa ibang agents."
          entries={pageItems}
          totalCount={entries.length}
          rowStartIndex={(page - 1) * PAGINATION_PAGE_SIZE}
          loading={loading}
          search={search}
          onSearchChange={onSearchChange}
          outcomeFilter={outcomeFilter}
          onFilterChange={onFilterChange}
          onPressEntry={(entry) => router.push({
            pathname: '/(manager)/more/sync-record/[id]',
            params: { id: entry.id },
          })}
        />
      </ScrollView>

      {totalPages > 0 ? (
        <BizFloatingPager page={page} totalPages={totalPages} onPageChange={setPage} bottomOffset={insets.bottom + 16} />
      ) : null}
    </YStack>
  );
}