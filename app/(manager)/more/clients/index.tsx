import { useMemo, useState } from 'react';
import { FlatList, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../../lib/client-status';
import { useTeamOverview } from '../../../../lib/use-team-overview';
import { avatarPaletteFor } from '../../../../lib/avatar-palette';
import { computeTeamClientProgress } from '../../../../lib/team-remote-mappers';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { Avatar } from '../../../../components/ui/Avatar';
import { CLIENT_STATUSES, type ClientStatus, type TeamAgent, type TeamClient, type TeamMeeting } from '../../../../types';

type StatusFilter = ClientStatus | 'all';

/** Wireframe s-clients — filter by agent + status, team-wide view (manager's own clients live in the separate `(manager)/clients` tab, F-205). Real data (B-054 Phase 1). */
export default function ManagerClientsScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useTeamOverview();
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const clients = overview?.clients ?? [];
  const meetings = overview?.meetings ?? [];
  const agents = overview?.agents ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (agentFilter !== 'all' && c.agentId !== agentFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clients, search, agentFilter, statusFilter]);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar
        title="Clients"
        fallbackHref="/(manager)/more"
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
        <XStack alignItems="center" backgroundColor={BIZLINK_COLORS.card} borderWidth={1} borderColor={BIZLINK_COLORS.line} borderRadius={16} height={52} paddingHorizontal={16} gap="$2">
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            <BizChip label="All" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
            {agents.map((a) => (
              <BizChip key={a.id} label={a.name.split(' ')[0]} selected={agentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
            ))}
          </XStack>
        </ScrollView>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            <BizChip label="All" selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
            {CLIENT_STATUSES.map((s) => (
              <BizChip key={s} label={CLIENT_STATUS_BADGES[s].label} selected={statusFilter === s} onPress={() => setStatusFilter(s)} />
            ))}
          </XStack>
        </ScrollView>
      </YStack>

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
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
          renderItem={({ item }) => <ClientRow client={item} agents={agents} meetings={meetings} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8">
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Walang client na tumugma sa filter.</Text>
            </YStack>
          }
          ListFooterComponent={
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$3.5">
              Bilang manager, nakikita mo ang buong team dito — para walang magkabanggaang agents sa iisang client.
            </Text>
          }
        />
      )}
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
        {client.status === 'prospect' ? (
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{progress}%</Text>
        ) : null}
      </YStack>
    </XStack>
  );
}
