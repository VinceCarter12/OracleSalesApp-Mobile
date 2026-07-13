import { Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Handshake } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../../lib/theme';
import {
  execAgentById,
  execClientById,
  execClientsForAgent,
  execManagerById,
  execMeetingsForAgent,
} from '../../../../lib/executive-data';
import { CLIENT_STATUS_BADGES } from '../../../../lib/client-status';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { TopBar } from '../../../../components/ui/TopBar';
import { LockButton } from '../../../../components/security/LockButton';
import { Card } from '../../../../components/ui/Card';
import { SectionHeader } from '../../../../components/ui/SectionHeader';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { execOutcomeBadge } from '../../../../components/executive/exec-badges';

/** Wireframe x-agentdetail — gated, view-only: one agent's stats, clients, meetings. */
export default function ExecutiveAgentDetailScreen() {
  const { unlocked } = useGate();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();

  if (!unlocked) return <SecurityGate />;

  const agent = execAgentById(agentId);
  if (!agent) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Text>Agent not found.</Text>
      </YStack>
    );
  }

  const manager = execManagerById(agent.managerId);
  const clients = execClientsForAgent(agent.id);
  const meetings = execMeetingsForAgent(agent.id);

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title={agent.name.split(' ')[0]} right={<LockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3.5">
          <XStack width={60} height={60} borderRadius={30} alignItems="center" justifyContent="center" backgroundColor={agent.avatar.background}>
            <Text fontWeight="800" fontSize={22} color={agent.avatar.color}>{agent.initials}</Text>
          </XStack>
          <YStack>
            <Text fontWeight="800" fontSize={17} color={COLORS.eel}>{agent.name}</Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>
              Sales Specialist · under {manager?.name ?? '—'}
            </Text>
          </YStack>
        </Card>

        <XStack gap="$2.5" marginTop="$3.5">
          <OverviewStat value={`${agent.meetings}`} label="Meetings" color={COLORS.ledgeGreen} />
          <OverviewStat value={`${agent.clients}`} label="Clients" color={COLORS.blue} />
          <OverviewStat value={`${agent.rate}%`} label="Success rate" color={COLORS.orange} />
        </XStack>

        <SectionHeader title="Clients" />
        {clients.length === 0 ? (
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} paddingVertical="$3">Walang clients.</Text>
        ) : null}
        {clients.map((client) => {
          const badge = CLIENT_STATUS_BADGES[client.status];
          return (
            <Pressable key={client.id} onPress={() => router.push(`/(executive)/clients/${client.id}`)}>
              <XStack alignItems="center" gap="$3" paddingVertical={13} borderBottomWidth={2} borderBottomColor={COLORS.polar}>
                <View width={38} height={38} borderRadius={19} alignItems="center" justifyContent="center" backgroundColor={COLORS.polar}>
                  <Text fontWeight="800" fontSize={13} color={COLORS.wolf}>{client.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <YStack flex={1} gap="$0.5">
                  <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client.name}</Text>
                  <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{client.channel}</Text>
                </YStack>
                <StatusBadge {...badge} />
                <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
              </XStack>
            </Pressable>
          );
        })}

        <SectionHeader title="Recent meetings" />
        {meetings.length === 0 ? (
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} paddingVertical="$3">Wala pang meetings.</Text>
        ) : null}
        {meetings.map((meeting) => (
          <Pressable key={meeting.id} onPress={() => router.push(`/(executive)/clients/meeting/${meeting.id}`)}>
            <XStack alignItems="center" gap="$3" paddingVertical={13} borderBottomWidth={2} borderBottomColor={COLORS.polar}>
              <View width={38} height={38} borderRadius={19} alignItems="center" justifyContent="center" backgroundColor={COLORS.polar}>
                <Handshake size={15} color={COLORS.wolf} />
              </View>
              <YStack flex={1} gap="$0.5">
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>
                  {execClientById(meeting.clientId)?.name ?? '—'}
                </Text>
                <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{meeting.date} · {meeting.time}</Text>
              </YStack>
              {execOutcomeBadge(meeting.outcome)}
              <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
            </XStack>
          </Pressable>
        ))}
      </ScrollView>
    </YStack>
  );
}

function OverviewStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow} borderWidth={2} borderColor={COLORS.swan} borderRadius={16} padding="$3" alignItems="center">
      <Text fontSize={22} fontWeight="800" color={color}>{value}</Text>
      <Text fontSize={10.5} fontWeight="700" color={COLORS.hare} textAlign="center">{label}</Text>
    </YStack>
  );
}
