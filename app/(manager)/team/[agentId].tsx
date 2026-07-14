import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Handshake, Inbox } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../lib/client-status';
import { AGENT_COLORS, agentById, clientsForAgent, meetingsForAgent } from '../../../lib/manager-data';
import { TopBar } from '../../../components/ui/TopBar';
import { LockButton } from '../../../components/security/LockButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { useGate } from '../../../lib/gate-context';
import { meetingBadge } from '../../../lib/meeting-badge';

/** Wireframe s-agent — gated (shows the agent's client list, which is sensitive). */
export default function AgentDetailScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const agent = agentById(agentId);

  if (!unlocked) return <SecurityGate />;
  if (!agent) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Text>Agent not found.</Text>
      </YStack>
    );
  }

  const color = AGENT_COLORS[agent.id];
  const clients = clientsForAgent(agent.id);
  const meetings = meetingsForAgent(agent.id);

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title={agent.name.split(' ')[0]} right={<LockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <XStack alignItems="center" gap="$3.5" backgroundColor={COLORS.snow} borderWidth={2} borderColor={COLORS.swan} borderRadius={16} padding="$3.5">
          <View width={60} height={60} borderRadius={30} alignItems="center" justifyContent="center" backgroundColor={color.background}>
            <Text fontWeight="800" fontSize={22} color={color.color}>{agent.initials}</Text>
          </View>
          <YStack>
            <Text fontWeight="800" fontSize={17} color={COLORS.eel}>{agent.name}</Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Sales Specialist · under your team</Text>
          </YStack>
        </XStack>

        <XStack gap="$2.5" marginTop="$3.5">
          <StatBox value={agent.meetingsThisMonth} label="Meetings this mo." color={COLORS.ledgeGreen} />
          <StatBox value={agent.activeClients} label="Active clients" color={COLORS.blue} />
          <StatBox value={`${agent.successRate}%`} label="Success rate" color={COLORS.orange} />
        </XStack>

        <SectionHeader title="Clients handled" />
        {clients.length === 0 ? (
          <EmptyRow icon={<Inbox size={22} color={COLORS.hare} />} label="Walang clients na naka-assign." />
        ) : (
          clients.map((c) => (
            <XStack
              key={c.id}
              alignItems="center"
              gap="$3"
              paddingVertical={13}
              borderBottomWidth={2}
              borderBottomColor={COLORS.polar}
              onPress={() => router.push(`/(manager)/more/clients/${c.id}`)}
            >
              <View width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={COLORS.polar}>
                <Text fontSize={12} fontWeight="800" color={COLORS.wolf}>{c.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <YStack flex={1}>
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{c.name}</Text>
                <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{c.channel}</Text>
              </YStack>
              <StatusBadge {...CLIENT_STATUS_BADGES[c.status]} />
              <ChevronRight size={16} color={COLORS.swanLedge} />
            </XStack>
          ))
        )}

        <SectionHeader title="Recent meetings" />
        {meetings.length === 0 ? (
          <EmptyRow icon={<Handshake size={22} color={COLORS.hare} />} label="Wala pang meetings." />
        ) : (
          meetings.map((m) => {
            const client = clients.find((c) => c.id === m.clientId);
            return (
              <XStack
                key={m.id}
                alignItems="center"
                gap="$3"
                paddingVertical={13}
                borderBottomWidth={2}
                borderBottomColor={COLORS.polar}
                onPress={() => router.push(`/(manager)/more/meetings/${m.id}`)}
              >
                <View width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={COLORS.polar}>
                  <Handshake size={15} color={COLORS.wolf} />
                </View>
                <YStack flex={1}>
                  <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client?.name ?? 'Unknown client'}</Text>
                  <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{m.date} · {m.time}</Text>
                </YStack>
                {meetingBadge(m)}
                <ChevronRight size={16} color={COLORS.swanLedge} />
              </XStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}

function StatBox({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow} borderWidth={2} borderColor={COLORS.swan} borderRadius={16} padding="$3">
      <Text fontSize={20} fontWeight="800" color={color}>{value}</Text>
      <Text fontSize={11.5} fontWeight="700" color={COLORS.hare}>{label}</Text>
    </YStack>
  );
}

function EmptyRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <YStack alignItems="center" paddingVertical="$5" gap="$2">
      {icon}
      <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center">{label}</Text>
    </YStack>
  );
}
