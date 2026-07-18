import { useMemo, useState } from 'react';
import { FlatList, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Eye, Search } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../lib/client-status';
import { EXEC_CLIENTS, EXEC_MANAGERS, execAgentById, execManagerById } from '../../../lib/executive-data';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizLockButton } from '../../../components/bizlink/BizLockButton';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { ClientStatus } from '../../../types';

type StatusFilter = Extract<ClientStatus, 'prospect' | 'new' | 'existing'> | 'all';

const STATUS_FILTERS: StatusFilter[] = ['all', 'prospect', 'new', 'existing'];

/** Wireframe x-clients — gated (ADR-007), view-only: ALL clients company-wide, filter by manager + status. */
export default function ExecutiveClientsScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const [search, setSearch] = useState('');
  const [managerFilter, setManagerFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EXEC_CLIENTS.filter((c) => {
      if (managerFilter !== 'all' && c.managerId !== managerFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, managerFilter, statusFilter]);

  if (!unlocked) return <SecurityGate />;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={21} color={BIZLINK_COLORS.text}>Clients</Text>
        <XStack marginLeft="auto"><BizLockButton /></XStack>
      </XStack>
      <YStack paddingHorizontal="$4" gap="$2.5">
        <XStack alignItems="center" backgroundColor={BIZLINK_COLORS.card} borderRadius={16} height={52} paddingHorizontal={14} gap="$2">
          <Search size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search company name…"
            placeholderTextColor={BIZLINK_COLORS.muted}
            style={{ flex: 1, fontFamily: BIZLINK_FONTS.medium, fontSize: 14.5, color: BIZLINK_COLORS.text }}
          />
        </XStack>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by manager</Text>
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label="All" selected={managerFilter === 'all'} onPress={() => setManagerFilter('all')} />
          {EXEC_MANAGERS.map((m) => (
            <BizChip key={m.id} label={m.name.split(' ')[0]} selected={managerFilter === m.id} onPress={() => setManagerFilter(m.id)} />
          ))}
        </XStack>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by status</Text>
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
      </YStack>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
        ListEmptyComponent={
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingVertical="$4">
            Walang client na tumugma.
          </Text>
        }
        ListFooterComponent={
          <XStack alignItems="center" justifyContent="center" gap="$1.5" paddingVertical="$3">
            <Eye size={13} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" flexShrink={1}>
              Nakikita mo ang LAHAT ng clients ng kumpanya — view-only, ang pag-approve ay sa manager.
            </Text>
          </XStack>
        }
        renderItem={({ item }) => {
          const agent = execAgentById(item.agentId);
          const manager = execManagerById(item.managerId);
          const badge = CLIENT_STATUS_BADGES[item.status];
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
              <Avatar initials={agent?.initials ?? '—'} size="sm" background={agent?.avatar.background ?? BIZLINK_COLORS.soft} color={agent?.avatar.color ?? BIZLINK_COLORS.muted} />
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
    </YStack>
  );
}
