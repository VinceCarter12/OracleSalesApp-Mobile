import { useMemo, useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { KeyboardAwareFlatList } from '../../../../components/ui/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Building2, Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../../lib/theme';
import { useTeamOverview } from '../../../../lib/use-team-overview';
import { useManagerScope } from '../../../../lib/manager-scope-store';
import { useSession } from '../../../../lib/session-store';
import { initialsFromName } from '../../../../lib/display-name';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { BizScopeFilter } from '../../../../components/bizlink/BizScopeFilter';
import { BizFilterSheet } from '../../../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../../../components/bizlink/BizFilterSheetRow';
import { DateRangeFilterRow } from '../../../../components/bizlink/DateRangeFilterRow';
import type { DateRange } from '../../../../components/bizlink/DateRangePickerModal';
import { BizFloatingPager } from '../../../../components/bizlink/BizFloatingPager';
import { ManagerClientRow } from '../../../../components/manager/ManagerClientRow';
import { PAGINATION_PAGE_SIZE, usePagination } from '../../../../lib/use-pagination';
import { isWithinDateRange } from '../../../../lib/date-range';
import { type ClientStatus, type TeamClient } from '../../../../types';

type StatusFilter = ClientStatus | 'all';

// Mirrors Sales' My Clients sort shape (app/(tabs)/clients/index.tsx) —
// 'needs_action' groups Prospect/In Progress first; TeamClient has no raw
// deadline timestamp (only the pre-formatted `deadline` string), so the
// tiebreaker is `createdAt` instead of the exact deadline Sales sorts by.
type ClientSortOption = 'needs_action' | 'newest' | 'company_az';
const CLIENT_SORT_OPTIONS: Array<{ value: ClientSortOption; label: string }> = [
  { value: 'needs_action', label: 'Needs action first' },
  { value: 'newest', label: 'Newest' },
  { value: 'company_az', label: 'Company A–Z' },
];

function sortTeamClients(list: TeamClient[], sort: ClientSortOption): TeamClient[] {
  const copy = [...list];
  const createdTime = (c: TeamClient): number => (c.createdAt ? new Date(c.createdAt).getTime() : 0);
  if (sort === 'company_az') {
    copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }
  if (sort === 'newest') {
    copy.sort((a, b) => createdTime(b) - createdTime(a));
    return copy;
  }
  copy.sort((a, b) => {
    const aNeeds = a.status === 'prospect' || a.status === 'in_progress';
    const bNeeds = b.status === 'prospect' || b.status === 'in_progress';
    if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
    return createdTime(b) - createdTime(a);
  });
  return copy;
}

// Same set/order as Sales' My Clients STATUS_FILTERS (app/(tabs)/clients/
// index.tsx) — "no Inactive chip" exclusion (that status is server-side
// lifecycle only, never agent-facing). Unlike Sales' version, this one is
// rendered inside the Filters sheet, not as a visible chip row outside it
// (Vince, 2026-08-21: keep the outcome/status chips inside Filters on both
// Manager Meeting Details and Manager Clients, not duplicated outside).
const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
];

/**
 * Wireframe s-clients — filter by agent + status, team-wide view (manager's
 * own clients live in the separate `(manager)/clients` tab, F-205). Real
 * data (B-054 Phase 1).
 *
 * UI parity pass (Vince, 2026-08-20/21): this screen's card had drifted
 * from Sales/RSR's "My Clients" (`app/(tabs)/clients/index.tsx`) — no row
 * numbering, a bare "%" instead of a progress bar. Rebuilt to match that
 * card anatomy (row-numbered `BizCard`, progress bar + percent), with ONE
 * deliberate addition Sales doesn't need: the agent avatar, since this is
 * a team-wide list, not always-"you". Status/Sort/Date filters live inside
 * the Filters sheet only (2026-08-21 direction), not as a chip row outside
 * it — same as Manager Meeting Details.
 */
export default function ManagerClientsScreen() {
  const insets = useSafeAreaInsets();
  const { scope } = useManagerScope();
  const { profileId, fullName } = useSession();
  const { overview, loading, error, reload } = useTeamOverview(scope);
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [sort, setSort] = useState<ClientSortOption>('newest');

  // Guest Records scope (2026-08-22): `overview.clients`/`.meetings` are
  // already `[]` for scope='guest' (`partitionByScope`'s explicit guest
  // case in `lib/manager-scope.ts`), so concatenating `guestClients`/
  // `guestMeetings` on top works uniformly for every scope value — no
  // per-scope branching needed here.
  const clients = [...(overview?.clients ?? []), ...(overview?.guestClients ?? [])];
  const meetings = [...(overview?.meetings ?? []), ...(overview?.guestMeetings ?? [])];
  const teamAgents = overview?.agents ?? [];
  // The manager's own profile only belongs in the agent-filter list when
  // scope can actually surface the manager's OWN clients ('mine'/'combined')
  // — 'team' already excluded it (unchanged); 'guest' must too, since a held
  // client was never created by the manager (fix, 2026-08-22: previously any
  // non-'team' scope added the manager here, which wrongly offered "filter
  // by me" on a screen showing only other agents' held clients).
  const agents =
    (scope === 'mine' || scope === 'combined') && profileId && fullName
      ? [...teamAgents, { id: profileId, name: fullName, initials: initialsFromName(fullName), meetingsThisMonth: 0, activeClients: 0, successRate: 0 }]
      : teamAgents;
  // Scope changes invalidate an agent selection from the previous view. Keep
  // the state stable (avoids cascading setState effects) and derive the
  // effective filter as All until the user picks an agent in the new scope.
  const effectiveAgentFilter = agents.some((agent) => agent.id === agentFilter) ? agentFilter : 'all';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = clients.filter((c) => {
      if (effectiveAgentFilter !== 'all' && c.agentId !== effectiveAgentFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!isWithinDateRange(c.createdAt ? new Date(c.createdAt) : new Date(0), dateRange)) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortTeamClients(matched, sort);
  }, [clients, search, effectiveAgentFilter, statusFilter, dateRange, sort]);
  const resetKey = `${scope}:${search.trim().toLowerCase()}:${effectiveAgentFilter}:${statusFilter}:${dateRange ? `${dateRange.start.getTime()}-${dateRange.end.getTime()}` : 'all'}:${sort}`;
  const { page, totalPages, pageItems, setPage } = usePagination(filtered, resetKey);

  const agentLabel = effectiveAgentFilter === 'all' ? 'All' : agents.find((a) => a.id === effectiveAgentFilter)?.name.split(' ')[0] ?? 'All';
  const sortLabel = CLIENT_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? sort;
  const filtersActive = effectiveAgentFilter !== 'all' || statusFilter !== 'all' || dateRange !== null || sort !== 'newest';

  function resetFilters(): void {
    setAgentFilter('all');
    setStatusFilter('all');
    setDateRange(null);
    setSort('newest');
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar
        title="Clients"
        fallbackHref="/(manager)"
        right={
          <BizButton
            small
            label="New Client"
            icon={<Plus size={14} color={BIZLINK_COLORS.card} strokeWidth={1.75} />}
            onPress={() => router.push('/(manager)/clients/create')}
            style={{ paddingHorizontal: 16 }}
          />
        }
      />
      <YStack paddingHorizontal="$4" gap="$2.5">
        <BizScopeFilter />
        <XStack gap="$2" alignItems="center">
          <XStack flex={1} alignItems="center" backgroundColor={BIZLINK_COLORS.card} borderWidth={1} borderColor={BIZLINK_COLORS.line} borderRadius={16} height={52} paddingHorizontal={16} gap="$2">
            <Search size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search company name…"
              placeholderTextColor={BIZLINK_COLORS.muted}
              style={{ flex: 1, fontFamily: BIZLINK_FONTS.medium, fontSize: 14.5, color: BIZLINK_COLORS.text }}
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
              borderWidth: 1,
              borderColor: filterOpen || filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.line,
            }}
          >
            <SlidersHorizontal size={16} color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}>Filters</Text>
          </Pressable>
        </XStack>

      </YStack>

      <BizFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
        {scope !== 'mine' ? (
          <BizFilterSheetRow label="Agent" value={agentLabel}>
            <XStack gap="$2" flexWrap="wrap">
              <BizChip label="All" selected={effectiveAgentFilter === 'all'} onPress={() => setAgentFilter('all')} />
              {agents.map((a) => (
                <BizChip key={a.id} label={a.name.split(' ')[0]} selected={effectiveAgentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
              ))}
            </XStack>
          </BizFilterSheetRow>
        ) : null}
        <BizFilterSheetRow label="Status" value={statusFilter === 'all' ? 'All' : STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? 'All'}>
          <XStack gap="$2" flexWrap="wrap">
            {STATUS_FILTERS.map((f) => (
              <BizChip key={f.value} label={f.label} selected={statusFilter === f.value} onPress={() => setStatusFilter(f.value)} />
            ))}
          </XStack>
        </BizFilterSheetRow>
        <DateRangeFilterRow range={dateRange} onApply={setDateRange} />
        <BizFilterSheetRow label="Sort" value={sortLabel}>
          <XStack gap="$2" flexWrap="wrap">
            {CLIENT_SORT_OPTIONS.map((option) => <BizChip key={option.value} label={option.label} selected={sort === option.value} onPress={() => setSort(option.value)} />)}
          </XStack>
        </BizFilterSheetRow>
      </BizFilterSheet>

      {loading ? (
        <YStack alignItems="center" paddingVertical="$6">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : error ? (
        <YStack alignItems="center" paddingVertical="$6" gap="$3">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
          <BizButton small label="Ulitin" variant="white" onPress={reload} />
        </YStack>
      ) : (
        <KeyboardAwareFlatList
          data={pageItems}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
          renderItem={({ item, index }) => (
            <ManagerClientRow client={item} rowNumber={(page - 1) * PAGINATION_PAGE_SIZE + index + 1} agents={agents} meetings={meetings} />
          )}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8" gap="$2.5">
              <Building2 size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>No client matches this filter.</Text>
            </YStack>
          }
          ListFooterComponent={
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$3.5">
              As a manager, you see the whole team here — so agents don't end up handling the same client.
            </Text>
          }
        />
      )}
      {filtered.length > 0 ? <BizFloatingPager page={page} totalPages={totalPages} onPageChange={setPage} bottomOffset={insets.bottom + 16} /> : null}
    </YStack>
  );
}
