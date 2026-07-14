import { useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../../lib/theme';
import { AGENT_COLORS, getManagerAgents, agentById, clientById } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { TopBar } from '../../../../components/ui/TopBar';
import { LockButton } from '../../../../components/security/LockButton';
import { SelectTile } from '../../../../components/ui/SelectTile';
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
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Sales History" right={<LockButton />} />
      <YStack paddingHorizontal="$4" gap="$2">
        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase">Filter by agent</Text>
        <XStack gap="$2" flexWrap="wrap">
          <SelectTile label="All" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
          {getManagerAgents().map((a) => (
            <SelectTile key={a.id} label={a.name.split(' ')[0]} selected={agentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
          ))}
        </XStack>
        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase">Filter by outcome</Text>
        <XStack gap="$2" flexWrap="wrap">
          <SelectTile label="All" selected={outcomeFilter === 'all'} onPress={() => setOutcomeFilter('all')} />
          {MANAGER_OUTCOMES.map((o) => (
            <SelectTile key={o} label={MANAGER_OUTCOME_LABELS[o]} selected={outcomeFilter === o} onPress={() => setOutcomeFilter(o)} />
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
              paddingVertical={13}
              borderBottomWidth={2}
              borderBottomColor={COLORS.polar}
              onPress={() => router.push(`/(manager)/more/meetings/${item.id}`)}
            >
              <XStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={color.background}>
                <Text fontSize={12} fontWeight="800" color={color.color}>{agent?.initials}</Text>
              </XStack>
              <YStack flex={1}>
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client?.name}</Text>
                <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
                  {agent?.name} · {item.date} · {item.time}{item.meetingMode === 'online' ? ' · Online' : ''}
                </Text>
              </YStack>
              <YStack alignItems="flex-end" gap="$1">
                {meetingBadge(item)}
                <Text fontSize={10.5} fontWeight="800" color={item.synced ? COLORS.ledgeGreen : COLORS.blue}>
                  {item.synced ? '✓ synced' : '↻ pending'}
                </Text>
              </YStack>
            </XStack>
          );
        }}
        ListEmptyComponent={
          <YStack alignItems="center" padding="$8">
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Walang meeting na tumugma.</Text>
          </YStack>
        }
      />
    </YStack>
  );
}
