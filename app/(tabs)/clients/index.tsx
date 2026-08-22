import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Building2, Plus, SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { useClients } from '../../../lib/useClients';
import { useMeetings } from '../../../lib/useMeetings';
import { SALES_CLIENT_STATUS_BADGES, getClientStatus, WAITING_MANAGER_APPROVAL_BADGE, MEETING_IN_PROGRESS_BADGE, WAITING_MANAGER_PO_APPROVAL_BADGE, WAITING_MANAGER_PO_APPROVAL_PROSPECT_BADGE } from '../../../lib/client-status';
import { getClientDeadlineInfo } from '../../../lib/client-deadline';
import { getQualifiedAgendaMilestones } from '../../../lib/client-progress';
import { getClientIdsWithPendingManagerTagAlong } from '../../../lib/tag-along-service';
import { getClientIdsWithPendingPoConfirmation, getClientIdsWithPendingProspectPoConfirmation } from '../../../lib/po-confirmation-service';
import { useActiveMeetingDrafts } from '../../../lib/use-active-meeting-drafts';
import { useSession } from '../../../lib/session-store';
import { useClientFlowRoutes } from '../../../lib/use-role-routes';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SyncBadge } from '../../../components/sync/SyncBadge';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../../components/bizlink/BizFilterSheetRow';
import { DateRangeFilterRow } from '../../../components/bizlink/DateRangeFilterRow';
import type { DateRange } from '../../../components/bizlink/DateRangePickerModal';
import { KeyboardAwareFlatList } from '../../../components/ui/KeyboardAwareScrollView';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { PAGINATION_PAGE_SIZE, usePagination } from '../../../lib/use-pagination';
import type { OutboxStatus } from '../../../lib/sync/outbox-status';
import type { Client, ClientStatus, Meeting } from '../../../types';
import { perfMark } from '../../../lib/perf-trace';

// Wireframe #a-clients' filter row is exactly All/Prospect/In Progress/New/
// Existing (ADR-042 four-stage lifecycle, Wireframe-Sales-BizLink.html
// `aRenderClientsFiltered`'s `statuses` array) — no "Inactive" chip (that
// status is server-side lifecycle only, never agent-facing, per
// types/index.ts's CLIENT_STATUSES comment).
type StatusFilter = ClientStatus | 'all';
const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
];

const ALL_CITIES = 'all';

type SortOption = 'needs_action' | 'newest' | 'company_az';
const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'needs_action', label: 'Needs action first' },
  { value: 'newest', label: 'Newest' },
  { value: 'company_az', label: 'Company A–Z' },
];

/** Inclusive day-level bounds check against a `DateRangeFilterRow` selection. */
function isWithinDateRange(date: Date, range: DateRange | null): boolean {
  if (!range) return true;
  const t = date.getTime();
  const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).getTime();
  const end = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59, 999).getTime();
  return t >= start && t <= end;
}

function sortClients(list: Client[], sort: SortOption): Client[] {
  const copy = [...list];
  if (sort === 'company_az') {
    copy.sort((a, b) => a.company_name.localeCompare(b.company_name));
    return copy;
  }
  if (sort === 'newest') {
    copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return copy;
  }
  // needs_action: clients still requiring follow-up (Prospect/In Progress)
  // first, most urgent deadline first within that group.
  copy.sort((a, b) => {
    const aNeeds = ['prospect', 'in_progress'].includes(getClientStatus(a));
    const bNeeds = ['prospect', 'in_progress'].includes(getClientStatus(b));
    if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
    const aDeadline = a.details_deadline_at ? new Date(a.details_deadline_at).getTime() : Infinity;
    const bDeadline = b.details_deadline_at ? new Date(b.details_deadline_at).getTime() : Infinity;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return copy;
}

/**
 * Wireframe #a-clients' exact card anatomy (`aRenderClientsFiltered`): row
 * number → company name → channel/detail line → metarow (sync pill +
 * deadline micro-label for Prospect + status pill) → qualified-agenda
 * progress bar (Prospect/In Progress only). Deadline and the progress meter
 * are gated exactly like the wireframe's own `c.status==='prospect'` /
 * `(c.status==='prospect'||c.status==='in_progress')` checks — New/Existing
 * never show a meta deadline or a progress meter.
 */
function ClientRow({
  client,
  rowNumber,
  meetings,
  waitingManagerApproval,
  meetingInProgress,
  waitingManagerPoApproval,
  waitingManagerPoApprovalAtProspect,
}: {
  client: Client;
  rowNumber: number;
  meetings: Meeting[];
  waitingManagerApproval: boolean;
  meetingInProgress: boolean;
  waitingManagerPoApproval: boolean;
  /** ADR-061 Scenario 1 — prospect-stage counterpart of `waitingManagerPoApproval`. */
  waitingManagerPoApprovalAtProspect: boolean;
}) {
  const BIZLINK_COLORS = useBizlinkColors();
  const routes = useClientFlowRoutes();
  const status = getClientStatus(client);
  const badge = SALES_CLIENT_STATUS_BADGES[status];
  const isProspect = status === 'prospect';
  const showsProgress = status === 'prospect' || status === 'in_progress';
  const deadline = isProspect ? getClientDeadlineInfo(client) : null;
  const milestones = showsProgress ? getQualifiedAgendaMilestones(client, meetings) : null;

  return (
    <Pressable onPress={() => router.push(routes.clientDetail(client.id))}>
      <BizCard gap="$1.5" paddingVertical={16} paddingHorizontal={18} marginBottom={10}>
        <XStack alignItems="center" gap="$2.5">
          <YStack
            width={26}
            height={26}
            borderRadius={13}
            backgroundColor={BIZLINK_COLORS.soft}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
              {rowNumber}
            </Text>
          </YStack>
          <Text
            flex={1}
            fontFamily={BIZLINK_FONTS.semibold}
            fontSize={15}
            letterSpacing={-0.2}
            color={BIZLINK_COLORS.text}
          >
            {client.company_name}
          </Text>
        </XStack>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$1">
          {client.sales_channel || 'No details yet — complete the info'}
        </Text>

        <XStack alignItems="center" gap="$2" marginTop="$1.5" flexWrap="wrap">
          {client.sync_status ? <SyncBadge status={client.sync_status as OutboxStatus} /> : null}
          {isProspect && deadline ? (
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Deadline{' '}
              <Text fontFamily={BIZLINK_FONTS.semibold} color={deadline.warn ? BIZLINK_COLORS.red : BIZLINK_COLORS.text}>
                {deadline.label}
              </Text>
            </Text>
          ) : null}
          <StatusBadge {...badge} />
          {/* F-204: overlay badge alongside (not replacing) the status pill. */}
          {waitingManagerApproval ? (
            <StatusBadge
              label={WAITING_MANAGER_APPROVAL_BADGE.label}
              background={BIZLINK_COLORS[WAITING_MANAGER_APPROVAL_BADGE.background]}
              color={BIZLINK_COLORS[WAITING_MANAGER_APPROVAL_BADGE.color]}
            />
          ) : null}
          {/* 2026-08-04: same-pattern overlay badge for a same-day, unfinished meeting_drafts row. */}
          {meetingInProgress ? (
            <StatusBadge
              label={MEETING_IN_PROGRESS_BADGE.label}
              background={BIZLINK_COLORS[MEETING_IN_PROGRESS_BADGE.background]}
              color={BIZLINK_COLORS[MEETING_IN_PROGRESS_BADGE.color]}
            />
          ) : null}
          {/* Vince 2026-08-04: overlay badge for a submitted, not-yet-decided PO confirmation on an in_progress client. */}
          {waitingManagerPoApproval ? (
            <StatusBadge
              label={WAITING_MANAGER_PO_APPROVAL_BADGE.label}
              background={BIZLINK_COLORS[WAITING_MANAGER_PO_APPROVAL_BADGE.background]}
              color={BIZLINK_COLORS[WAITING_MANAGER_PO_APPROVAL_BADGE.color]}
            />
          ) : null}
          {/* ADR-061 Scenario 1: same overlay, prospect-stage variant — the client stays PROSPECT while this is pending. */}
          {waitingManagerPoApprovalAtProspect ? (
            <StatusBadge
              label={WAITING_MANAGER_PO_APPROVAL_PROSPECT_BADGE.label}
              background={BIZLINK_COLORS[WAITING_MANAGER_PO_APPROVAL_PROSPECT_BADGE.background]}
              color={BIZLINK_COLORS[WAITING_MANAGER_PO_APPROVAL_PROSPECT_BADGE.color]}
            />
          ) : null}
          <Text color={BIZLINK_COLORS.muted} fontSize={16} marginLeft="auto">›</Text>
        </XStack>

        {milestones ? (
          <YStack marginTop="$1.5" gap="$1">
            <XStack alignItems="center" gap="$2.5">
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                Qualified agenda progress
              </Text>
              <YStack flex={1} height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.soft} overflow="hidden">
                <YStack height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.brand} width={`${milestones.percent}%`} />
              </YStack>
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                {milestones.percent}%
              </Text>
            </XStack>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {milestones.completed}/{milestones.total} agenda milestones
            </Text>
          </YStack>
        ) : null}
      </BizCard>
    </Pressable>
  );
}

export default function ClientsScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const routes = useClientFlowRoutes();
  const { clients, loading, refresh } = useClients();
  const { meetings } = useMeetings();
  const { profileId } = useSession();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [cityFilter, setCityFilter] = useState<string>(ALL_CITIES);
  const [sort, setSort] = useState<SortOption>('newest');
  // F-204: batch-loaded once per focus, not per-row (same N+1 avoidance as
  // meetings/index.tsx's getMyCompanionRequests bulk-load).
  const [waitingManagerApprovalIds, setWaitingManagerApprovalIds] = useState<Set<string>>(new Set());
  const [waitingManagerPoApprovalIds, setWaitingManagerPoApprovalIds] = useState<Set<string>>(new Set());
  const [waitingManagerPoApprovalAtProspectIds, setWaitingManagerPoApprovalAtProspectIds] = useState<Set<string>>(new Set());
  const { activeMeetingClientIds } = useActiveMeetingDrafts(profileId);

  // Refreshes on every return to this screen — e.g. right after Create
  // Client saves locally (client-service.ts), so the new row shows up
  // without needing a manual pull-to-refresh.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useFocusEffect(
    useCallback(() => {
      if (!profileId) return;
      getClientIdsWithPendingManagerTagAlong(profileId)
        .then(setWaitingManagerApprovalIds)
        .catch((err) => console.error('[MyClients] pending manager tag-along lookup failed:', err instanceof Error ? err.message : String(err)));
      getClientIdsWithPendingPoConfirmation(profileId)
        .then(setWaitingManagerPoApprovalIds)
        .catch((err) => console.error('[MyClients] pending PO confirmation lookup failed:', err instanceof Error ? err.message : String(err)));
      getClientIdsWithPendingProspectPoConfirmation(profileId)
        .then(setWaitingManagerPoApprovalAtProspectIds)
        .catch((err) => console.error('[MyClients] pending prospect PO confirmation lookup failed:', err instanceof Error ? err.message : String(err)));
    }, [profileId])
  );

  // Real distinct cities from the local snapshot — never a hardcoded list.
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => { if (c.city) set.add(c.city); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clients]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = clients.filter((c) => {
      if (filter !== 'all' && getClientStatus(c) !== filter) return false;
      if (cityFilter !== ALL_CITIES && c.city !== cityFilter) return false;
      if (!isWithinDateRange(new Date(c.created_at), dateRange)) return false;
      if (query) {
        const matchesName = c.company_name.toLowerCase().includes(query);
        const matchesCity = (c.city ?? '').toLowerCase().includes(query);
        if (!matchesName && !matchesCity) return false;
      }
      return true;
    });
    return sortClients(matched, sort);
  }, [clients, search, filter, cityFilter, dateRange, sort]);

  // Wireframe #a-clients' `aRenderPager` (page size 10) applied AFTER the
  // filter/search pass above — same order as `aRenderClientsFiltered`,
  // which paginates the already-filtered `shown` array. Resets to page 1
  // whenever any filter/sort/search input changes.
  const resetKey = `${filter}:${search.trim().toLowerCase()}:${cityFilter}:${dateRange ? `${dateRange.start.getTime()}-${dateRange.end.getTime()}` : 'all'}:${sort}`;
  const { page, totalPages, pageItems, setPage } = usePagination(filtered, resetKey);

  useEffect(() => {
    if (!loading) {
      perfMark('clients.visible', { clients: clients.length, pageItems: pageItems.length });
    }
  }, [clients.length, loading, pageItems.length]);

  const filtersActive = cityFilter !== ALL_CITIES || dateRange !== null || sort !== 'newest';

  const resetFilters = (): void => { setCityFilter(ALL_CITIES); setDateRange(null); setSort('newest'); };

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar
        title="My Clients"
        fallbackHref="/(tabs)"
        right={
          <Pressable
            onPress={() => router.push(routes.createClient())}
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
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Create a Client</Text>
          </Pressable>
        }
      />

      <YStack paddingHorizontal="$4" gap="$2.5" marginTop="$2">
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            {STATUS_FILTERS.map((f) => (
              <BizChip
                key={f.value}
                label={f.label}
                selected={filter === f.value}
                onPress={() => setFilter(f.value)}
              />
            ))}
          </XStack>
        </ScrollView>
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

        <BizFilterSheetRow label="Sort" value={SORT_OPTIONS.find((option) => option.value === sort)?.label ?? sort}>
          <XStack gap="$2" flexWrap="wrap">
            {SORT_OPTIONS.map((option) => (
              <BizChip key={option.value} label={option.label} selected={sort === option.value} onPress={() => setSort(option.value)} />
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 + insets.bottom, paddingTop: 20 }}
          renderItem={({ item, index }) => (
            <ClientRow
              client={item}
              rowNumber={(page - 1) * PAGINATION_PAGE_SIZE + index + 1}
              meetings={meetings}
              waitingManagerApproval={waitingManagerApprovalIds.has(item.id)}
              meetingInProgress={activeMeetingClientIds.has(item.id)}
              waitingManagerPoApproval={waitingManagerPoApprovalIds.has(item.id)}
              waitingManagerPoApprovalAtProspect={waitingManagerPoApprovalAtProspectIds.has(item.id)}
            />
          )}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8" gap="$2.5">
              <Building2 size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
                {clients.length === 0 ? 'You have no clients yet.' : 'No client matches these filters.'}
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
