import { useCallback, useMemo, useState } from 'react';
import { getSyncHistory, type SyncHistoryEntry } from './sync-history';
import { getDisplayStatus, type SyncHistoryFilterValue } from './sync-history-display';
import { usePagination } from './use-pagination';

/**
 * Shared Sync History screen logic (Batch 2026-08-09): loads the local
 * outbox terminal rows, owns the search/outcome-filter state, and paginates
 * the filtered result at `PAGINATION_PAGE_SIZE` (10) so both the Sales and
 * Manager Sync History screens render the same `BizFloatingPager` sibling —
 * lifting this out of `components/sync/SyncHistoryList.tsx` keeps that
 * component presentational and gives the floating pager the page/total state
 * the screens need (pagers are rendered AFTER the list, per
 * `BizFloatingPager`'s positioning contract).
 */
export function useSyncHistory() {
  const [entries, setEntries] = useState<SyncHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<SyncHistoryFilterValue>('all');

  const reload = useCallback(() => {
    setLoading(true);
    getSyncHistory()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const displayStatus = getDisplayStatus(entry);
      if (outcomeFilter !== 'all' && displayStatus !== outcomeFilter) return false;
      if (!query) return true;
      return (
        entry.label.toLowerCase().includes(query) ||
        displayStatus.toLowerCase().includes(query) ||
        (entry.lastError ?? '').toLowerCase().includes(query)
      );
    });
  }, [entries, search, outcomeFilter]);

  const { page, totalPages, pageItems, setPage } = usePagination(
    filteredEntries,
    `${outcomeFilter}:${search.trim().toLowerCase()}`
  );

  return {
    entries,
    loading,
    reload,
    search,
    onSearchChange: setSearch,
    outcomeFilter,
    onFilterChange: setOutcomeFilter,
    filteredEntries,
    page,
    totalPages,
    pageItems,
    setPage,
  };
}