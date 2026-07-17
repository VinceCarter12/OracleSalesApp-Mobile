import { useMemo, useState } from 'react';
import { FlatList, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../../lib/client-status';
import { AGENT_COLORS, getManagerAgents, agentById, computeTeamClientProgress } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizLockButton } from '../../../../components/bizlink/BizLockButton';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { Avatar } from '../../../../components/ui/Avatar';
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
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Clients" right={<BizLockButton />} />
      <YStack paddingHorizontal="$4" gap="$2.5">
        <XStack alignItems="center" backgroundColor={BIZLINK_COLORS.card} borderRadius={16} height={52} paddingHorizontal={16} gap="$2">
          <Search size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search company name…"
            placeholderTextColor={BIZLINK_COLORS.muted}
            style={{ flex: 1, fontFamily: BIZLINK_FONTS.medium, fontSize: 14.5, color: BIZLINK_COLORS.text }}
          />
        </XStack>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by agent</Text>
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label="All" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
          {getManagerAgents().map((a) => (
            <BizChip key={a.id} label={a.name.split(' ')[0]} selected={agentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
          ))}
        </XStack>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by status</Text>
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label="All" selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
          {CLIENT_STATUSES.map((s) => (
            <BizChip key={s} label={CLIENT_STATUS_BADGES[s].label} selected={statusFilter === s} onPress={() => setStatusFilter(s)} />
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
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Walang client na tumugma sa filter.</Text>
          </YStack>
        }
        ListFooterComponent={
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$3.5">
            Bilang manager, nakikita mo ang SARILI mo + buong team — para walang magkabanggaang agents sa iisang
            client.
          </Text>
        }
      />

      <YStack paddingHorizontal="$4" paddingBottom="$3" paddingTop="$2">
        <BizButton label="+ New Client" onPress={() => router.push('/(manager)/more/clients/create')} />
      </YStack>
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
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{agent?.name} · {client.channel}</Text>
        )}
      </YStack>
      <YStack alignItems="flex-end" gap="$1">
        <StatusBadge {...CLIENT_STATUS_BADGES[client.status]} />
        {client.status === 'prospect' ? (
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{progress}%</Text>
        ) : null}
      </YStack>
    </XStack>
  );
}
