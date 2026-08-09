import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Handshake, Plus, SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { useMeetings } from '../../../lib/useMeetings';
import { useClients } from '../../../lib/useClients';
import { useSession } from '../../../lib/session-store';
import { getMyCompanionRequests } from '../../../lib/tag-along-service';
import { formatMeetingLocation } from '../../../lib/format-meeting-location';
import { MeetingRow } from '../../../components/meetings/MeetingRow';
import { MeetingFilterPanel, ALL_LOCATIONS, ALL_AGENDAS, type LocationFilter, type AgendaFilter, type MeetingSortOption, type ClientStatusFilter } from '../../../components/meetings/MeetingFilterPanel';
import { getClientStatus } from '../../../lib/client-status';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import { DateRangeFilterRow } from '../../../components/bizlink/DateRangeFilterRow';
import type { DateRange } from '../../../components/bizlink/DateRangePickerModal';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { PAGINATION_PAGE_SIZE, usePagination } from '../../../lib/use-pagination';
import { MEETING_OUTCOMES, type Client, type Meeting, type MeetingOutcome } from '../../../types';

type OutcomeFilter = MeetingOutcome | 'all';

function sortMeetings(list: Meeting[], sort: MeetingSortOption): Meeting[] {
  const copy = [...list];
  if (sort === 'company_az') {
    copy.sort((a, b) => (a.client_name ?? '').localeCompare(b.client_name ?? ''));
    return copy;
  }
  copy.sort((a, b) => {
    const diff = new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime();
    return sort === 'oldest' ? -diff : diff;
  });
  return copy;
}

// Wireframe a-meetings' outcome chip row (aRenderMeetings): short display
// labels mapped to the real MeetingOutcome enum values — the chip text is
// NEVER compared directly against a meeting's outcome.
const OUTCOME_FILTERS: Array<{ value: OutcomeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  ...MEETING_OUTCOMES.map((outcome) => ({
    value: outcome as OutcomeFilter,
    label:
      outcome === 'Follow-up Required' ? 'Follow-up' :
      outcome === 'No Decision' ? 'No decision' :
      outcome === 'Lost Opportunity' ? 'Lost' :
      outcome,
  })),
];

/** Inclusive day-level bounds check against a `DateRangeFilterRow` selection. */
function isWithinDateRange(date: Date, range: DateRange | null): boolean {
  if (!range) return true;
  const t = date.getTime();
  const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).getTime();
  const end = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59, 999).getTime();
  return t >= start && t <= end;
}

export default function MeetingsScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { meetings, loading, refresh } = useMeetings();
  const { clients } = useClients();
  const { profileId } = useSession();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const [filter, setFilter] = useState<OutcomeFilter>('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>(ALL_LOCATIONS);
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>(ALL_AGENDAS);
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatusFilter>('all');
  const [sort, setSort] = useState<MeetingSortOption>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [tagAlongMeetingIds, setTagAlongMeetingIds] = useState<Set<string>>(new Set());

  // Bulk-loaded once (not per-row) to avoid an N+1 query per list render —
  // builds a lookup of which meetings have an attached companion request,
  // for the list row's inline "tag-along" chip (Wireframe a-meetings).
  useFocusEffect(
    useCallback(() => {
      if (!profileId) return;
      getMyCompanionRequests(profileId)
        .then((requests) => {
          setTagAlongMeetingIds(new Set(requests.filter((r) => r.relatedMeetingId).map((r) => r.relatedMeetingId as string)));
        })
        .catch((err) => console.error('[MyMeetings] tag-along lookup failed:', err instanceof Error ? err.message : String(err)));
    }, [profileId])
  );

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = meetings.filter((m) => {
      if (filter !== 'all' && m.outcome !== filter) return false;
      if (!isWithinDateRange(new Date(m.logged_at), dateRange)) return false;
      if (locationFilter !== ALL_LOCATIONS && m.location_type !== locationFilter) return false;
      if (agendaFilter !== ALL_AGENDAS && !m.agendas.includes(agendaFilter)) return false;
      if (clientStatusFilter !== 'all') {
        const client = m.client_id ? clientsById.get(m.client_id) : undefined;
        if (!client || getClientStatus(client) !== clientStatusFilter) return false;
      }
      if (!query) return true;
      const location = formatMeetingLocation(m) ?? '';
      return (m.client_name ?? '').toLowerCase().includes(query) || location.toLowerCase().includes(query);
    });
    return sortMeetings(matched, sort);
  }, [meetings, filter, dateRange, locationFilter, agendaFilter, clientStatusFilter, clientsById, search, sort]);

  // Reset to page 1 whenever any filter/search input changes, matching the
  // wireframe's aFiltMeetings/aSearchMeetings/aSetMeetingMonth (each sets
  // aMeetingPage=1) — same pattern as My Clients (lib/use-pagination.ts).
  const resetKey = `${filter}:${dateRange ? `${dateRange.start.getTime()}-${dateRange.end.getTime()}` : 'all'}:${locationFilter}:${agendaFilter}:${clientStatusFilter}:${sort}:${search.trim().toLowerCase()}`;
  const { page, totalPages, pageItems, setPage } = usePagination(filtered, resetKey);

  const filtersActive = dateRange !== null || locationFilter !== ALL_LOCATIONS || agendaFilter !== ALL_AGENDAS || clientStatusFilter !== 'all' || sort !== 'newest';

  const resetFilters = (): void => {
    setDateRange(null);
    setLocationFilter(ALL_LOCATIONS);
    setAgendaFilter(ALL_AGENDAS);
    setClientStatusFilter('all');
    setSort('newest');
  };

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar
        title="Meeting Details"
        fallbackHref="/(tabs)"
        right={
          <Pressable
            onPress={() => router.push('/(tabs)/meetings/select-client')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: BIZLINK_COLORS.brand,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 10,
              minHeight: 44,
            }}
          >
            <Plus size={14} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Select Client</Text>
          </Pressable>
        }
      />

      <YStack paddingHorizontal="$4" gap="$2.5" marginTop="$2" marginBottom="$3">
        <XStack gap="$2" alignItems="center">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search company or location…"
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
      </YStack>

      <BizFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
        <DateRangeFilterRow range={dateRange} onApply={setDateRange} />
        <MeetingFilterPanel
          locationFilter={locationFilter}
          onLocationChange={setLocationFilter}
          agendaFilter={agendaFilter}
          onAgendaChange={setAgendaFilter}
          clientStatusFilter={clientStatusFilter}
          onClientStatusChange={setClientStatusFilter}
          sort={sort}
          onSortChange={setSort}
        />
      </BizFilterSheet>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <XStack gap="$2" marginBottom="$2.5">
          {OUTCOME_FILTERS.map((o) => (
            <BizChip
              key={o.value}
              label={o.label}
              selected={filter === o.value}
              onPress={() => setFilter(o.value)}
            />
          ))}
        </XStack>
      </ScrollView>

      {loading && !meetings.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : (
        <FlatList
          data={pageItems}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 + insets.bottom }}
          renderItem={({ item, index }) => (
            <MeetingRow
              meeting={item}
              client={item.client_id ? clientsById.get(item.client_id) : undefined}
              meetings={meetings}
              hasTagAlong={tagAlongMeetingIds.has(item.id)}
              rowNumber={(page - 1) * PAGINATION_PAGE_SIZE + index + 1}
            />
          )}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8" gap="$2.5">
              <Handshake size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
                {meetings.length === 0 ? 'No meetings recorded yet.' : 'Walang tumugma sa filter.'}
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
