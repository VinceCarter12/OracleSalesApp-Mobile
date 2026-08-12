import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { YStack } from 'tamagui';
import { useBizlinkColors } from '../../../lib/theme';
import { useSyncHistory } from '../../../lib/use-sync-history';
import { PAGINATION_PAGE_SIZE } from '../../../lib/use-pagination';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { SyncHistoryList } from '../../../components/sync/SyncHistoryList';
import { KeyboardAwareScrollView } from '../../../components/ui/KeyboardAwareScrollView';

/**
 * Wireframe `id="a-synchistory"` (`aRenderSyncHistory()`, ~line 2454) —
 * 2026-08-05 redesign matching Screenshots 1 & 2: numbered list items,
 * status icons, tap card to navigate to detail screen, search + filter chips.
 * Row/detail rendering shared with `app/(manager)/more/sync-history.tsx` via
 * `components/sync/SyncHistoryList.tsx` (Batch 2026-08-08). Pagination state
 * lives in `lib/use-sync-history.ts`; the floating pager is rendered here as a
 * sibling AFTER the list (Batch 2026-08-09), same position contract as every
 * other paginated screen.
 */
export default function SyncHistoryScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const {
    loading, reload, search, onSearchChange, outcomeFilter, onFilterChange,
    dateRange, onDateRangeChange, filtersActive, resetFilters,
    entries, pageItems, page, totalPages, setPage,
  } = useSyncHistory();

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sync History" fallbackHref="/(tabs)" />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <SyncHistoryList
          description="Records uploaded from (or flagged as a problem on) this device — newest first."
          entries={pageItems}
          totalCount={entries.length}
          rowStartIndex={(page - 1) * PAGINATION_PAGE_SIZE}
          loading={loading}
          search={search}
          onSearchChange={onSearchChange}
          outcomeFilter={outcomeFilter}
          onFilterChange={onFilterChange}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          filtersActive={filtersActive}
          onResetFilters={resetFilters}
          onPressEntry={(entry) => router.push({
            pathname: '/(tabs)/more/sync-record/[id]',
            params: { id: entry.id },
          })}
        />
      </KeyboardAwareScrollView>

      {totalPages > 0 ? (
        <BizFloatingPager page={page} totalPages={totalPages} onPageChange={setPage} bottomOffset={insets.bottom + 16} />
      ) : null}
    </YStack>
  );
}
