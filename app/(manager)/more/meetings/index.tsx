import { useMemo, useState } from 'react';
import { FlatList, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useTeamOverview } from '../../../../lib/use-team-overview';
import { useManagerScope } from '../../../../lib/manager-scope-store';
import { useSession } from '../../../../lib/session-store';
import { initialsFromName } from '../../../../lib/display-name';
import { avatarPaletteFor } from '../../../../lib/avatar-palette';
import { CLIENT_STATUS_BADGES } from '../../../../lib/client-status';
import { computeTeamClientProgress } from '../../../../lib/team-remote-mappers';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { BizScopeFilter } from '../../../../components/bizlink/BizScopeFilter';
import { Avatar } from '../../../../components/ui/Avatar';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { meetingBadge } from '../../../../lib/meeting-badge';
import { MANAGER_OUTCOMES, MANAGER_OUTCOME_LABELS, type ManagerOutcome } from '../../../../types';

type OutcomeFilter = ManagerOutcome | 'all';

/** Wireframe s-meetings: scoped, searchable sales-history list backed by real team data. */
export default function ManagerMeetingsScreen() {
  const insets = useSafeAreaInsets();
  const { scope } = useManagerScope();
  const { overview, loading, error, reload } = useTeamOverview(scope);
  const { profileId, fullName } = useSession();
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [query, setQuery] = useState('');
  const [lastScope, setLastScope] = useState(scope);

  if (scope !== lastScope) {
    setLastScope(scope);
    setAgentFilter('all');
  }

  const meetings = overview?.meetings ?? [];
  const clients = overview?.clients ?? [];
  const agents = overview?.agents ?? [];
  const agentsWithManager = profileId && fullName
    ? [...agents, { id: profileId, name: fullName, initials: initialsFromName(fullName), meetingsThisMonth: 0, activeClients: 0, successRate: 0 }]
    : agents;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => meetings.filter((meeting) => {
    const client = clients.find((candidate) => candidate.id === meeting.clientId);
    return (agentFilter === 'all' || meeting.agentId === agentFilter)
      && (outcomeFilter === 'all' || meeting.outcome === outcomeFilter)
      && (!normalizedQuery || [client?.name, meeting.location].join(' ').toLowerCase().includes(normalizedQuery));
  }), [meetings, clients, agentFilter, outcomeFilter, normalizedQuery]);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Meeting Details" />
      <YStack paddingHorizontal="$4" gap="$2">
        <XStack alignItems="center" gap="$2" height={44} paddingHorizontal={12} backgroundColor={BIZLINK_COLORS.card} borderRadius={16}>
          <Search size={17} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search company or location..." placeholderTextColor={BIZLINK_COLORS.muted} style={{ flex: 1, color: BIZLINK_COLORS.text, fontFamily: BIZLINK_FONTS.medium, fontSize: 13 }} />
        </XStack>
        <BizScopeFilter />
        {scope !== 'mine' ? <>
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by agent</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><XStack gap="$2">
            <BizChip label="All" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
            {agents.map((agent) => <BizChip key={agent.id} label={agent.name.split(' ')[0]} selected={agentFilter === agent.id} onPress={() => setAgentFilter(agent.id)} />)}
          </XStack></ScrollView>
        </> : null}
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by outcome</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><XStack gap="$2">
          <BizChip label="All" selected={outcomeFilter === 'all'} onPress={() => setOutcomeFilter('all')} />
          {MANAGER_OUTCOMES.map((outcome) => <BizChip key={outcome} label={MANAGER_OUTCOME_LABELS[outcome]} selected={outcomeFilter === outcome} onPress={() => setOutcomeFilter(outcome)} />)}
        </XStack></ScrollView>
      </YStack>

      {loading ? <YStack alignItems="center" paddingVertical="$6"><Spinner size="large" color={BIZLINK_COLORS.brand} /></YStack>
        : error ? <YStack alignItems="center" paddingVertical="$6" gap="$3"><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text><BizButton small label="Ulitin" variant="white" onPress={reload} /></YStack>
          : <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
              renderItem={({ item, index }) => {
                const client = clients.find((candidate) => candidate.id === item.clientId);
                const agent = agentsWithManager.find((candidate) => candidate.id === item.agentId);
                const palette = avatarPaletteFor(item.agentId);
                const progress = client ? computeTeamClientProgress(client, meetings.filter((meeting) => meeting.clientId === client.id)) : 0;
                return <XStack alignItems="flex-start" gap="$2.5" backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} marginBottom={10} onPress={() => router.push(`/(manager)/more/meetings/${item.id}`)}>
                  <YStack width={24} height={24} borderRadius={12} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center" marginTop="$0.5"><Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>{index + 1}</Text></YStack>
                  <YStack flex={1} gap="$1.5">
                    <XStack alignItems="center" gap="$2"><Avatar initials={agent?.initials ?? '—'} size="sm" background={palette.background} color={palette.color} /><YStack flex={1}><Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client?.name ?? 'Unknown client'}</Text><Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{agent?.name ?? 'Unassigned'}</Text></YStack></XStack>
                    <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{item.date} · {item.time} · {item.location}{item.meetingMode === 'online' ? ' · Online' : ''}</Text>
                    <XStack alignItems="center" gap="$1.5" flexWrap="wrap">{meetingBadge(item)}{client ? <StatusBadge {...CLIENT_STATUS_BADGES[client.status]} /> : null}<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={item.synced ? BIZLINK_COLORS.brand : BIZLINK_COLORS.navy}>{item.synced ? '✓ synced' : '↻ pending'}</Text>{item.tagAlong ? <XStack alignItems="center" gap="$0.5"><Users size={11} color={BIZLINK_COLORS.navy} strokeWidth={1.75} /><Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.navy}>tag-along</Text></XStack> : null}</XStack>
                    {client ? <XStack alignItems="center" gap="$2"><Text fontSize={10} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} width={58}>{client.status === 'in_progress' ? 'In progress' : client.status.charAt(0).toUpperCase() + client.status.slice(1)}</Text><YStack flex={1} height={4} borderRadius={2} backgroundColor={BIZLINK_COLORS.soft}><YStack width={`${progress}%`} height={4} borderRadius={2} backgroundColor={BIZLINK_COLORS.brand} /></YStack><Text fontSize={10} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{progress}%</Text></XStack> : null}
                  </YStack>
                </XStack>;
              }}
              ListEmptyComponent={<YStack alignItems="center" padding="$8"><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Walang meeting na tumugma.</Text></YStack>}
            />}
    </YStack>
  );
}
