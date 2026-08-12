import { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput } from 'react-native';
import { KeyboardAwareFlatList } from '../../../../components/ui/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../../lib/client-status';
import { useTeamOverview } from '../../../../lib/use-team-overview';
import { useManagerScope } from '../../../../lib/manager-scope-store';
import { useSession } from '../../../../lib/session-store';
import { initialsFromName } from '../../../../lib/display-name';
import { avatarPaletteFor } from '../../../../lib/avatar-palette';
import { computeTeamClientProgress } from '../../../../lib/team-remote-mappers';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { BizScopeFilter } from '../../../../components/bizlink/BizScopeFilter';
import { BizFilterSheet } from '../../../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../../../components/bizlink/BizFilterSheetRow';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { Avatar } from '../../../../components/ui/Avatar';
import { BizFloatingPager } from '../../../../components/bizlink/BizFloatingPager';
import { usePagination } from '../../../../lib/use-pagination';
import { type ClientStatus, type TeamAgent, type TeamClient, type TeamMeeting } from '../../../../types';

type StatusFilter = ClientStatus | 'all';

// Wireframe-Manager-BizLink.html:1340 — `var statuses = [['all','All'],
// ['prospect','Prospect'],['in_progress','In Progress'],['new','New'],
// ['existing','Existing'],['inactive','Inactive']];` — the chip row DOES
// include 'in_progress', positioned between 'prospect' and 'new'. Kept as an
// explicit list rather than deriving from `CLIENT_STATUSES` so this order is
// pinned to the wireframe's exact sequence rather than incidental array order.
const CLIENT_STATUS_FILTER_ORDER: readonly ClientStatus[] = ['prospect', 'in_progress', 'new', 'existing', 'inactive'];

/** Wireframe s-clients — filter by agent + status, team-wide view (manager's own clients live in the separate `(manager)/clients` tab, F-205). Real data (B-054 Phase 1). */
export default function ManagerClientsScreen() {
  const insets = useSafeAreaInsets();
  const { scope } = useManagerScope();
  const { profileId, fullName } = useSession();
  const { overview, loading, error, reload } = useTeamOverview(scope);
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const clients = overview?.clients ?? [];
  const meetings = overview?.meetings ?? [];
  const teamAgents = overview?.agents ?? [];
  const agents =
    scope !== 'team' && profileId && fullName
      ? [...teamAgents, { id: profileId, name: fullName, initials: initialsFromName(fullName), meetingsThisMonth: 0, activeClients: 0, successRate: 0 }]
      : teamAgents;
  // Scope changes invalidate an agent selection from the previous view. Keep
  // the state stable (avoids cascading setState effects) and derive the
  // effective filter as All until the user picks an agent in the new scope.
  const effectiveAgentFilter = agents.some((agent) => agent.id === agentFilter) ? agentFilter : 'all';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (effectiveAgentFilter !== 'all' && c.agentId !== effectiveAgentFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clients, search, effectiveAgentFilter, statusFilter]);
  const resetKey = `${scope}:${search.trim().toLowerCase()}:${effectiveAgentFilter}:${statusFilter}`;
  const { page, totalPages, pageItems, setPage } = usePagination(filtered, resetKey);

  const agentLabel = effectiveAgentFilter === 'all' ? 'All' : agents.find((a) => a.id === effectiveAgentFilter)?.name.split(' ')[0] ?? 'All';
  const statusLabel = statusFilter === 'all' ? 'All' : CLIENT_STATUS_BADGES[statusFilter].label;
  const filtersActive = effectiveAgentFilter !== 'all' || statusFilter !== 'all';

  function resetFilters(): void {
    setAgentFilter('all');
    setStatusFilter('all');
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
        <BizFilterSheetRow label="Status" value={statusLabel}>
          <XStack gap="$2" flexWrap="wrap">
            <BizChip label="All" selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
            {CLIENT_STATUS_FILTER_ORDER.map((s) => (
              <BizChip key={s} label={CLIENT_STATUS_BADGES[s].label} selected={statusFilter === s} onPress={() => setStatusFilter(s)} />
            ))}
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
          renderItem={({ item }) => <ClientRow client={item} agents={agents} meetings={meetings} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8">
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

function ClientRow({ client, agents, meetings }: { client: TeamClient; agents: TeamAgent[]; meetings: TeamMeeting[] }) {
  const agent = agents.find((a) => a.id === client.agentId);
  const color = avatarPaletteFor(client.agentId);
  const progress = computeTeamClientProgress(client, meetings);
  return (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      padding={14}
      marginBottom={10}
      onPress={() => router.push(`/(manager)/more/clients/${client.id}`)}
    >
      <Avatar initials={agent?.initials ?? '—'} size="sm" background={color.background} color={color.color} />
      <YStack flex={1}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.name}</Text>
        {client.deadlineWarn ? (
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.red}>{client.deadline}</Text>
        ) : (
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{agent?.name ?? 'Unassigned'} · {client.channel}</Text>
        )}
      </YStack>
      <YStack alignItems="flex-end" gap="$1">
        <StatusBadge {...CLIENT_STATUS_BADGES[client.status]} />
        {client.status === 'prospect' || client.status === 'in_progress' ? (
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{progress}%</Text>
        ) : null}
      </YStack>
    </XStack>
  );
}
