import { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput } from 'react-native';
import { KeyboardAwareFlatList } from '../../../components/ui/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Eye, Search, SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../lib/client-status';
import { useExecutiveOverview } from '../../../lib/use-executive-overview';
import { avatarPaletteFor } from '../../../lib/avatar-palette';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../../components/bizlink/BizFilterSheetRow';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { ClientStatus, ExecAgent, ExecManager } from '../../../types';

type StatusFilter = Extract<ClientStatus, 'prospect' | 'in_progress' | 'new' | 'existing'> | 'all';

// Order mirrors Wireframe-Executive-BizLink.html's xRenderClients() `statuses` array
// (all, prospect, in_progress, new, existing) — ADR-046 point 6.
const STATUS_FILTERS: StatusFilter[] = ['all', 'prospect', 'in_progress', 'new', 'existing'];

/** Wireframe x-clients — gated by the root `LockGate` (Batch 5 Slice 3, ADR-051), view-only: ALL clients company-wide, filter by manager + status. B-054 Phase 2: real data. */
export default function ExecutiveClientsScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useExecutiveOverview();
  const [search, setSearch] = useState('');
  const [managerFilter, setManagerFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const managers = overview?.managers ?? [];
  const agentById = useMemo(() => new Map(overview?.agents.map((a) => [a.id, a]) ?? []), [overview]);
  const managerById = useMemo(() => new Map(managers.map((m) => [m.id, m])), [managers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (overview?.clients ?? []).filter((c) => {
      if (managerFilter !== 'all' && c.managerId !== managerFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [overview, search, managerFilter, statusFilter]);

  const managerLabel = managerFilter === 'all' ? 'All' : managers.find((m) => m.id === managerFilter)?.name.split(' ')[0] ?? 'All';
  const statusLabel = statusFilter === 'all' ? 'All' : CLIENT_STATUS_BADGES[statusFilter].label;
  const filtersActive = managerFilter !== 'all' || statusFilter !== 'all';

  function resetFilters(): void {
    setManagerFilter('all');
    setStatusFilter('all');
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Clients" />
      <YStack paddingHorizontal="$4" gap="$2.5">
        <XStack gap="$2" alignItems="center">
          <XStack flex={1} alignItems="center" backgroundColor={BIZLINK_COLORS.card} borderRadius={16} height={52} paddingHorizontal={14} gap="$2">
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
        <BizFilterSheetRow label="Manager" value={managerLabel}>
          <XStack gap="$2" flexWrap="wrap">
            <BizChip label="All" selected={managerFilter === 'all'} onPress={() => setManagerFilter('all')} />
            {managers.map((m: ExecManager) => (
              <BizChip key={m.id} label={m.name.split(' ')[0]} selected={managerFilter === m.id} onPress={() => setManagerFilter(m.id)} />
            ))}
          </XStack>
        </BizFilterSheetRow>
        <BizFilterSheetRow label="Status" value={statusLabel}>
          <XStack gap="$2" flexWrap="wrap">
            {STATUS_FILTERS.map((s) => (
              <BizChip
                key={s}
                label={s === 'all' ? 'All' : CLIENT_STATUS_BADGES[s].label}
                selected={statusFilter === s}
                onPress={() => setStatusFilter(s)}
              />
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
          <BizButton small label="Retry" variant="white" onPress={reload} />
        </YStack>
      ) : (
        <KeyboardAwareFlatList
          data={filtered}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
          ListEmptyComponent={
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingVertical="$4">
              No matching clients.
            </Text>
          }
          ListFooterComponent={
            <XStack alignItems="center" justifyContent="center" gap="$1.5" paddingVertical="$3">
              <Eye size={13} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" flexShrink={1}>
                You can see ALL company clients — view-only; approvals happen at the manager level.
              </Text>
            </XStack>
          }
          renderItem={({ item }) => {
            const agent: ExecAgent | undefined = agentById.get(item.agentId);
            const manager = item.managerId ? managerById.get(item.managerId) : undefined;
            const badge = CLIENT_STATUS_BADGES[item.status];
            const agentColor = agent ? avatarPaletteFor(agent.id) : null;
            return (
              <XStack
                alignItems="center"
                gap="$3"
                backgroundColor={BIZLINK_COLORS.card}
                borderRadius={20}
                padding={14}
                marginBottom={10}
                onPress={() => router.push(`/(executive)/clients/${item.id}`)}
              >
                <Avatar initials={agent?.initials ?? '—'} size="sm" background={agentColor?.background ?? BIZLINK_COLORS.soft} color={agentColor?.color ?? BIZLINK_COLORS.muted} />
                <YStack flex={1} gap="$0.5">
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{item.name}</Text>
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                    {agent?.name ?? '—'} · {manager?.name ?? '—'}
                  </Text>
                </YStack>
                <StatusBadge {...badge} />
                <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
              </XStack>
            );
          }}
        />
      )}
    </YStack>
  );
}
