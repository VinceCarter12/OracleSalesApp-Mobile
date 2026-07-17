import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Handshake, Inbox } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../lib/client-status';
import { agentById, clientsForAgent, meetingsForAgent } from '../../../lib/manager-data';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizLockButton } from '../../../components/bizlink/BizLockButton';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
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
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Agent not found.</Text>
      </YStack>
    );
  }

  const clients = clientsForAgent(agent.id);
  const meetings = meetingsForAgent(agent.id);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={agent.name.split(' ')[0]} right={<BizLockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <XStack alignItems="center" gap="$3.5" backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18}>
          <Avatar initials={agent.initials} size="lg" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>{agent.name}</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Sales Specialist · under your team</Text>
          </YStack>
        </XStack>

        <XStack gap={10} marginTop={14}>
          <StatBox value={agent.meetingsThisMonth} label="Meetings this mo." />
          <StatBox value={agent.activeClients} label="Active clients" />
          <StatBox value={`${agent.successRate}%`} label="Success rate" />
        </XStack>

        <BizSectionHeader title="Clients handled" />
        {clients.length === 0 ? (
          <EmptyRow icon={<Inbox size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Walang clients na naka-assign." />
        ) : (
          clients.map((c) => (
            <XStack
              key={c.id}
              alignItems="center"
              gap="$3"
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              padding={14}
              marginBottom={10}
              onPress={() => router.push(`/(manager)/more/clients/${c.id}`)}
            >
              <Avatar initials={c.name.slice(0, 2).toUpperCase()} size="sm" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.muted} />
              <YStack flex={1}>
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{c.name}</Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{c.channel}</Text>
              </YStack>
              <StatusBadge {...CLIENT_STATUS_BADGES[c.status]} />
              <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
            </XStack>
          ))
        )}

        <BizSectionHeader title="Recent meetings" />
        {meetings.length === 0 ? (
          <EmptyRow icon={<Handshake size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Wala pang meetings." />
        ) : (
          meetings.map((m) => {
            const client = clients.find((c) => c.id === m.clientId);
            return (
              <XStack
                key={m.id}
                alignItems="center"
                gap="$3"
                backgroundColor={BIZLINK_COLORS.card}
                borderRadius={20}
                padding={14}
                marginBottom={10}
                onPress={() => router.push(`/(manager)/more/meetings/${m.id}`)}
              >
                <YStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.soft}>
                  <Handshake size={15} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
                </YStack>
                <YStack flex={1}>
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client?.name ?? 'Unknown client'}</Text>
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{m.date} · {m.time}</Text>
                </YStack>
                {meetingBadge(m)}
                <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
              </XStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}

function StatBox({ value, label }: { value: number | string; label: string }) {
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14}>
      <Text fontSize={20} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{value}</Text>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{label}</Text>
    </YStack>
  );
}

function EmptyRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <YStack alignItems="center" paddingVertical="$5" gap="$2">
      {icon}
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{label}</Text>
    </YStack>
  );
}
