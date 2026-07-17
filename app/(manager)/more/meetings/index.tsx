import { useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { AGENT_COLORS, getManagerAgents, agentById, clientById } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizLockButton } from '../../../../components/bizlink/BizLockButton';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { Avatar } from '../../../../components/ui/Avatar';
import { meetingBadge } from '../../../../lib/meeting-badge';
import { MANAGER_OUTCOMES, MANAGER_OUTCOME_LABELS, type ManagerOutcome } from '../../../../types';

type OutcomeFilter = ManagerOutcome | 'all';

/** Wireframe s-meetings — gated, filter by agent + outcome. */
export default function ManagerMeetingsScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { meetings } = useManagerStore();
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');

  const filtered = useMemo(
    () =>
      meetings.filter(
        (m) =>
          (agentFilter === 'all' || m.agentId === agentFilter) &&
          (outcomeFilter === 'all' || m.outcome === outcomeFilter)
      ),
    [meetings, agentFilter, outcomeFilter]
  );

  if (!unlocked) return <SecurityGate />;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sales History" right={<BizLockButton />} />
      <YStack paddingHorizontal="$4" gap="$2">
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by agent</Text>
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label="All" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
          {getManagerAgents().map((a) => (
            <BizChip key={a.id} label={a.name.split(' ')[0]} selected={agentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
          ))}
        </XStack>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by outcome</Text>
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label="All" selected={outcomeFilter === 'all'} onPress={() => setOutcomeFilter('all')} />
          {MANAGER_OUTCOMES.map((o) => (
            <BizChip key={o} label={MANAGER_OUTCOME_LABELS[o]} selected={outcomeFilter === o} onPress={() => setOutcomeFilter(o)} />
          ))}
        </XStack>
      </YStack>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
        renderItem={({ item }) => {
          const client = clientById(item.clientId);
          const agent = agentById(item.agentId);
          const color = AGENT_COLORS[item.agentId];
          return (
            <XStack
              alignItems="center"
              gap="$3"
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              padding={14}
              marginBottom={10}
              onPress={() => router.push(`/(manager)/more/meetings/${item.id}`)}
            >
              <Avatar initials={agent?.initials ?? '—'} size="sm" background={color.background} color={color.color} />
              <YStack flex={1}>
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client?.name}</Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  {agent?.name} · {item.date} · {item.time}{item.meetingMode === 'online' ? ' · Online' : ''}
                </Text>
              </YStack>
              <YStack alignItems="flex-end" gap="$1">
                {meetingBadge(item)}
                <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={item.synced ? BIZLINK_COLORS.brand : BIZLINK_COLORS.navy}>
                  {item.synced ? '✓ synced' : '↻ pending'}
                </Text>
              </YStack>
            </XStack>
          );
        }}
        ListEmptyComponent={
          <YStack alignItems="center" padding="$8">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Walang meeting na tumugma.</Text>
          </YStack>
        }
      />
    </YStack>
  );
}
