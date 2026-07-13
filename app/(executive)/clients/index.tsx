import { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Eye, Search } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../lib/client-status';
import { EXEC_CLIENTS, EXEC_MANAGERS, execAgentById, execManagerById } from '../../../lib/executive-data';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { LockButton } from '../../../components/security/LockButton';
import { SelectTile } from '../../../components/ui/SelectTile';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { ClientStatus } from '../../../types';

type StatusFilter = Extract<ClientStatus, 'prospect' | 'new' | 'existing'> | 'all';

const STATUS_FILTERS: StatusFilter[] = ['all', 'prospect', 'new', 'existing'];

/** Wireframe x-clients — gated, view-only: ALL clients company-wide, filter by manager + status. */
export default function ExecutiveClientsScreen() {
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
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>Clients</Text>
        <XStack marginLeft="auto"><LockButton /></XStack>
      </XStack>
      <YStack paddingHorizontal="$4" gap="$2.5">
        <XStack alignItems="center" borderWidth={2} borderColor={COLORS.swan} borderRadius={12} height={50} paddingHorizontal={14} gap="$2">
          <Search size={16} color={COLORS.hare} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search company name…"
            placeholderTextColor={COLORS.hare}
            style={{ flex: 1, fontWeight: '700', fontSize: 14.5, color: COLORS.eel }}
          />
        </XStack>
        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase">Filter by manager</Text>
        <XStack gap="$2" flexWrap="wrap">
          <SelectTile label="All" selected={managerFilter === 'all'} onPress={() => setManagerFilter('all')} />
          {EXEC_MANAGERS.map((m) => (
            <SelectTile key={m.id} label={m.name.split(' ')[0]} selected={managerFilter === m.id} onPress={() => setManagerFilter(m.id)} />
          ))}
        </XStack>
        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase">Filter by status</Text>
        <XStack gap="$2" flexWrap="wrap">
          {STATUS_FILTERS.map((s) => (
            <SelectTile
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
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center" paddingVertical="$4">
            Walang client na tumugma.
          </Text>
        }
        ListFooterComponent={
          <XStack alignItems="center" justifyContent="center" gap="$1.5" paddingVertical="$3">
            <Eye size={13} color={COLORS.hare} />
            <Text fontSize={12} fontWeight="600" color={COLORS.hare} textAlign="center" flexShrink={1}>
              Nakikita mo ang LAHAT ng clients ng kumpanya — view-only, ang pag-approve ay sa manager.
            </Text>
          </XStack>
        }
        renderItem={({ item }) => {
          const agent = execAgentById(item.agentId);
          const manager = execManagerById(item.managerId);
          const badge = CLIENT_STATUS_BADGES[item.status];
          return (
            <Pressable onPress={() => router.push(`/(executive)/clients/${item.id}`)}>
              <XStack alignItems="center" gap="$3" paddingVertical={13} borderBottomWidth={2} borderBottomColor={COLORS.polar}>
                <View width={38} height={38} borderRadius={19} alignItems="center" justifyContent="center" backgroundColor={agent?.avatar.background ?? COLORS.polar}>
                  <Text fontWeight="800" fontSize={13} color={agent?.avatar.color ?? COLORS.wolf}>{agent?.initials ?? '—'}</Text>
                </View>
                <YStack flex={1} gap="$0.5">
                  <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{item.name}</Text>
                  <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
                    {agent?.name ?? '—'} · {manager?.name ?? '—'}
                  </Text>
                </YStack>
                <StatusBadge {...badge} />
                <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
              </XStack>
            </Pressable>
          );
        }}
      />
    </YStack>
  );
}
