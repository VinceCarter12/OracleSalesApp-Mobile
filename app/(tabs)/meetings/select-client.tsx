import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { useClients } from '../../../lib/useClients';
import { getClientStatus } from '../../../lib/client-status';
import { useActiveMeetingDrafts } from '../../../lib/use-active-meeting-drafts';
import { useSession } from '../../../lib/session-store';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { BizFilterScroll } from '../../../components/bizlink/BizFilterScroll';
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../../components/bizlink/BizFilterSheetRow';
import { BizChip } from '../../../components/bizlink/BizChip';
import { DateRangeFilterRow } from '../../../components/bizlink/DateRangeFilterRow';
import type { DateRange } from '../../../components/bizlink/DateRangePickerModal';
import { KeyboardAwareFlatList } from '../../../components/ui/KeyboardAwareScrollView';
import { RecordPickerRow, RECORD_PICKER_FILTERS, type RecordPickerFilter } from '../../../components/meetings/RecordPickerRow';
import { PAGINATION_PAGE_SIZE, usePagination } from '../../../lib/use-pagination';

// Same "no city selected" sentinel as My Clients' `ALL_CITIES`
// (app/(tabs)/clients/index.tsx) — kept local since each screen owns its
// own filter state, but the value/shape is identical by convention.
const ALL_CITIES = 'all';

// Same helper duplicated locally in My Clients and My Meetings
// (isWithinDateRange) — each screen owns its own filter state, so per that
// existing convention this stays local rather than a one-off shared import.
function isWithinDateRange(date: Date, range: DateRange | null): boolean {
  if (!range) return true;
  const t = date.getTime();
  const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).getTime();
  const end = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59, 999).getTime();
  return t >= start && t <= end;
}

export default function SelectClientScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { clients, loading, refresh } = useClients();
  const { profileId } = useSession();
  // 2026-08-09 (Vince direct instruction): distinguishes "this row's client
  // has a meeting actually running right now" from the `status` lifecycle
  // badge — re-fetched on focus by the hook itself, same source that
  // already powers the Home dashboard alert/tile glow.
  const { activeMeetingClientIds } = useActiveMeetingDrafts(profileId);
  // Wireframe-Sales-BizLink.html:1549 — `var aRecordSelectedClientId = null,
  // aRecordPickerFilter = 'all';` — default filter is 'all', not 'existing'.
  const [statusFilter, setStatusFilter] = useState<RecordPickerFilter>('all');
  const [search, setSearch] = useState('');
  // Advanced filter housed behind the "Filters" button, same split as My
  // Clients (app/(tabs)/clients/index.tsx): the primary status dimension
  // stays as always-visible chips, secondary dimensions live in the sheet.
  const [filterOpen, setFilterOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>(ALL_CITIES);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Without this, a client created via Create Client (or completed via
  // Complete Info) never shows up here until a manual pull-to-refresh or app
  // restart — useClients() only fetches once on mount, and this screen can
  // stay mounted across navigations.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Real distinct cities from the local snapshot, same approach as My
  // Clients — never a hardcoded list.
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => { if (c.city) set.add(c.city); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clients]);

  // Wireframe-Sales-BizLink.html:1759-1764 (`aRenderRecordPicker`) — search
  // by company name or city, case-insensitive, applied after the status
  // filter, same order as the My Clients / Lost Opportunities pickers.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== 'all' && getClientStatus(c) !== statusFilter) return false;
      if (cityFilter !== ALL_CITIES && c.city !== cityFilter) return false;
      if (!isWithinDateRange(new Date(c.created_at), dateRange)) return false;
      if (query) {
        const matchesName = c.company_name.toLowerCase().includes(query);
        const matchesCity = (c.city ?? '').toLowerCase().includes(query);
        if (!matchesName && !matchesCity) return false;
      }
      return true;
    });
  }, [clients, statusFilter, cityFilter, dateRange, search]);

  // Wireframe-Sales-BizLink.html:1765-1773 (`aRenderPager`, page size 10) —
  // reuses the same `usePagination` hook as My Clients/Lost Opportunities;
  // resets to page 1 on any filter/search change via the resetKey.
  const resetKey = `${statusFilter}:${cityFilter}:${dateRange ? `${dateRange.start.getTime()}-${dateRange.end.getTime()}` : 'all'}:${search.trim().toLowerCase()}`;
  const { page, totalPages, pageItems, setPage } = usePagination(filtered, resetKey);
  const filtersActive = cityFilter !== ALL_CITIES || dateRange !== null;
  const resetFilters = (): void => { setCityFilter(ALL_CITIES); setDateRange(null); };

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Record Meeting" />
      <YStack paddingHorizontal="$4" paddingBottom="$2" gap="$1">
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          New and Existing clients go straight to photo capture — no form to re-fill.
        </Text>
      </YStack>

      <YStack paddingHorizontal="$4" marginBottom="$2.5" gap="$2.5">
        <XStack gap="$2" alignItems="center">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search company or city…"
            placeholderTextColor={BIZLINK_COLORS.muted}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 16,
              paddingHorizontal: 16,
              fontFamily: BIZLINK_FONTS.medium,
              fontSize: 14.5,
              color: BIZLINK_COLORS.text,
              backgroundColor: BIZLINK_COLORS.card,
              borderWidth: 1,
              borderColor: BIZLINK_COLORS.line,
            }}
          />
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
              borderWidth: 1,
              borderColor: filterOpen || filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.line,
            }}
          >
            <SlidersHorizontal
              size={16}
              color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}
              strokeWidth={1.75}
            />
            <Text
              fontSize={11.5}
              fontFamily={BIZLINK_FONTS.medium}
              color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}
            >
              Filters
            </Text>
          </Pressable>
        </XStack>
        <BizFilterScroll options={RECORD_PICKER_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </YStack>

      <BizFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
        <DateRangeFilterRow range={dateRange} onApply={setDateRange} />

        <BizFilterSheetRow label="City" value={cityFilter === ALL_CITIES ? 'All cities' : cityFilter}>
          <XStack gap="$2" flexWrap="wrap">
            <BizChip label="All cities" selected={cityFilter === ALL_CITIES} onPress={() => setCityFilter(ALL_CITIES)} />
            {cityOptions.map((city) => (
              <BizChip key={city} label={city} selected={cityFilter === city} onPress={() => setCityFilter(city)} />
            ))}
          </XStack>
        </BizFilterSheetRow>
      </BizFilterSheet>

      {loading && !clients.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : (
        <KeyboardAwareFlatList
          data={pageItems}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 + insets.bottom }}
          renderItem={({ item, index }) => (
            <RecordPickerRow
              client={item}
              rowNumber={(page - 1) * PAGINATION_PAGE_SIZE + index + 1}
              isMeetingActive={activeMeetingClientIds.has(item.id)}
            />
          )}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
              <Text color={BIZLINK_COLORS.muted}>
                {clients.length === 0 ? 'No clients yet.' : 'No client here.'}
              </Text>
            </YStack>
          }
        />
      )}

      {filtered.length > 0 ? (
        <BizFloatingPager page={page} totalPages={totalPages} onPageChange={setPage} bottomOffset={insets.bottom + 16} />
      ) : null}
    </YStack>
  );
}
