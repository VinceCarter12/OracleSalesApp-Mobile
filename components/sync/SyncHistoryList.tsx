import { useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Search, SlidersHorizontal, Check, GitBranch, RotateCcw, AlertTriangle, ChevronRight } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import type { SyncHistoryEntry } from '../../lib/sync-history';
import {
  getDisplayStatus,
  getResultMessage,
  SYNC_HISTORY_OUTCOME_FILTERS,
  type SyncHistoryFilterValue,
} from '../../lib/sync-history-display';
import type { DateRange } from '../bizlink/DateRangePickerModal';
import { DateRangeFilterRow } from '../bizlink/DateRangeFilterRow';
import { BizFilterSheet } from '../bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../bizlink/BizFilterSheetRow';
import { BizChip } from '../bizlink/BizChip';

function getStatusIcon(entry: SyncHistoryEntry) {
  const status = getDisplayStatus(entry);
  if (status === 'synced') return Check;
  if (status === 'resolved') return GitBranch;
  if (status === 'retried') return RotateCcw;
  return AlertTriangle;
}

interface SyncHistoryListProps {
  description: string;
  /** Already-paginated rows for the current page (`pageItems` from `lib/use-sync-history.ts`) — this component is presentational; it does no filtering or slicing. */
  entries: SyncHistoryEntry[];
  /** Unfiltered entry count, so the empty state can distinguish "no history at all" from "no search/filter match". */
  totalCount: number;
  /** 0-based index of this page's first row in the full filtered list, for continuous row numbering across pages. */
  rowStartIndex: number;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  outcomeFilter: SyncHistoryFilterValue;
  onFilterChange: (value: SyncHistoryFilterValue) => void;
  dateRange: DateRange | null;
  onDateRangeChange: (range: DateRange | null) => void;
  filtersActive: boolean;
  onResetFilters: () => void;
  onPressEntry: (entry: SyncHistoryEntry) => void;
}

/**
 * Shared "Sync History" list body — the pattern common to both
 * `Wireframe-Sales-BizLink.html` (`id="a-synchistory"`, `aRenderSyncHistory()`)
 * and `Wireframe-Manager-BizLink.html` (`id="sync-history"`, explicitly
 * labeled "SHARED SYNC HISTORY PATTERN (own-device only)" in that file):
 * description copy, search bar, outcome filter chips, and numbered rows with
 * a status icon. Pagination state is owned by `useSyncHistory`
 * (`lib/use-sync-history.ts`) and rendered by the screens' `BizFloatingPager`
 * sibling — see `BizFloatingPager`'s positioning contract.
 */
export function SyncHistoryList({
  description,
  entries,
  totalCount,
  rowStartIndex,
  loading,
  search,
  onSearchChange,
  outcomeFilter,
  onFilterChange,
  dateRange,
  onDateRangeChange,
  filtersActive,
  onResetFilters,
  onPressEntry,
}: SyncHistoryListProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [filterOpen, setFilterOpen] = useState(false);
  const outcomeLabel = SYNC_HISTORY_OUTCOME_FILTERS.find((o) => o.value === outcomeFilter)?.label ?? outcomeFilter;

  return (
    <>
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={18}>
        {description}
      </Text>

      {/* Search Bar + Filters toggle — same pattern as Meeting Details (app/(tabs)/meetings/index.tsx) */}
      <XStack gap="$2" alignItems="center" marginBottom="$3">
        <XStack flex={1} alignItems="center" gap="$2" height={52} paddingHorizontal={16} backgroundColor={BIZLINK_COLORS.card} borderRadius={16}>
          <Search size={17} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <TextInput
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search record or result..."
            placeholderTextColor={BIZLINK_COLORS.muted}
            style={{
              flex: 1,
              fontFamily: BIZLINK_FONTS.medium,
              fontSize: 14,
              color: BIZLINK_COLORS.text,
            }}
          />
        </XStack>
        <Pressable
          accessibilityLabel="Toggle filters"
          onPress={() => setFilterOpen((open) => !open)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: filterOpen || filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.card,
            borderRadius: 16,
            paddingHorizontal: 14,
            height: 52,
          }}
        >
          <SlidersHorizontal
            size={16}
            color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}
            strokeWidth={1.75}
          />
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}>
            Filters
          </Text>
        </Pressable>
      </XStack>

      <BizFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filtersActive={filtersActive} onReset={onResetFilters}>
        <DateRangeFilterRow range={dateRange} onApply={onDateRangeChange} />
        <BizFilterSheetRow label="Status" value={outcomeLabel}>
          <XStack gap="$2" flexWrap="wrap">
            {SYNC_HISTORY_OUTCOME_FILTERS.map((option) => (
              <BizChip key={option.value} label={option.label} selected={outcomeFilter === option.value} onPress={() => onFilterChange(option.value)} />
            ))}
          </XStack>
        </BizFilterSheetRow>
      </BizFilterSheet>

      {/* Sync History List */}
      {loading && totalCount === 0 ? (
        <YStack alignItems="center" padding="$8">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : entries.length === 0 ? (
        <YStack alignItems="center" padding="$8" gap="$2.5">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            {totalCount === 0 ? 'Wala pang sync history.' : 'Walang record na tumugma sa search/filter.'}
          </Text>
        </YStack>
      ) : (
        entries.map((entry, index) => {
          const StatusIcon = getStatusIcon(entry);
          const displayStatus = getDisplayStatus(entry);

          return (
            <XStack
              key={entry.id}
              onPress={() => onPressEntry(entry)}
              pressStyle={{ opacity: 0.7 }}
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              padding={16}
              marginBottom={12}
              alignItems="center"
              gap="$3"
            >
              {/* Number Badge */}
              <View
                width={32}
                height={32}
                borderRadius={16}
                backgroundColor={BIZLINK_COLORS.soft}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                  {rowStartIndex + index + 1}
                </Text>
              </View>

              {/* Status Icon */}
              <StatusIcon
                size={18}
                color={
                  displayStatus === 'synced' ? BIZLINK_COLORS.brand :
                  displayStatus === 'resolved' || displayStatus === 'retried' ? BIZLINK_COLORS.navy :
                  BIZLINK_COLORS.muted
                }
                strokeWidth={2}
              />

              {/* Content */}
              <YStack flex={1} gap="$0.5">
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
                  {entry.label}
                </Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  {getResultMessage(entry)} · {new Date(entry.occurredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </YStack>

              {/* Chevron */}
              <ChevronRight size={18} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            </XStack>
          );
        })
      )}
    </>
  );
}