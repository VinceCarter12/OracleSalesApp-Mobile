import { useMemo, useState } from 'react';
import { FlatList, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../../lib/client-status';
import { AGENT_COLORS, getManagerAgents, agentById, computeTeamClientProgress } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { TopBar } from '../../../../components/ui/TopBar';
import { LockButton } from '../../../../components/security/LockButton';
import { SelectTile } from '../../../../components/ui/SelectTile';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { CLIENT_STATUSES, type ClientStatus, type TeamClient } from '../../../../types';

type StatusFilter = ClientStatus | 'all';

/** Wireframe s-clients — gated: filter by agent + status, manager sees self + whole team. */
export default function ManagerClientsScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { clients, meetings } = useManagerStore();
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (agentFilter !== 'all' && c.agentId !== agentFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clients, search, agentFilter, statusFilter]);

  if (!unlocked) return <SecurityGate />;

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Clients" right={<LockButton />} />
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
        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase">Filter by agent</Text>
        <XStack gap="$2" flexWrap="wrap">
          <SelectTile label="All" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
          {getManagerAgents().map((a) => (
            <SelectTile key={a.id} label={a.name.split(' ')[0]} selected={agentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
          ))}
        </XStack>
        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase">Filter by status</Text>
        <XStack gap="$2" flexWrap="wrap">
          <SelectTile label="All" selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
          {CLIENT_STATUSES.map((s) => (
            <SelectTile key={s} label={CLIENT_STATUS_BADGES[s].label} selected={statusFilter === s} onPress={() => setStatusFilter(s)} />
          ))}
        </XStack>
      </YStack>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
        renderItem={({ item }) => <ClientRow client={item} />}
        ListEmptyComponent={
          <YStack alignItems="center" padding="$8">
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Walang client na tumugma sa filter.</Text>
          </YStack>
        }
        ListFooterComponent={
          <Text fontSize={12.5} fontWeight="600" color={COLORS.hare} textAlign="center" marginTop="$3.5">
            Bilang manager, nakikita mo ang SARILI mo + buong team — para walang magkabanggaang agents sa iisang
            client.
          </Text>
        }
      />
    </YStack>
  );
}

function ClientRow({ client }: { client: TeamClient }) {
  const agent = agentById(client.agentId);
  const color = AGENT_COLORS[client.agentId];
  const { meetings } = useManagerStore();
  const progress = computeTeamClientProgress(client, meetings);
  return (
    <XStack
      alignItems="center"
      gap="$3"
      paddingVertical={13}
      borderBottomWidth={2}
      borderBottomColor={COLORS.polar}
      onPress={() => router.push(`/(manager)/more/clients/${client.id}`)}
    >
      <XStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={color.background}>
        <Text fontSize={12} fontWeight="800" color={color.color}>{agent?.initials}</Text>
      </XStack>
      <YStack flex={1}>
        <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client.name}</Text>
        {client.deadlineWarn ? (
          <Text fontSize={11.5} fontWeight="800" color={COLORS.red}>{client.deadline}</Text>
        ) : (
          <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{agent?.name} · {client.channel}</Text>
        )}
      </YStack>
      <YStack alignItems="flex-end" gap="$1">
        <StatusBadge {...CLIENT_STATUS_BADGES[client.status]} />
        {client.status === 'prospect' ? (
          <Text fontSize={12} fontWeight="800" color={COLORS.ledgeGreen}>{progress}%</Text>
        ) : null}
      </YStack>
    </XStack>
  );
}
