import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Handshake } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
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
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizLockButton } from '../../../../components/bizlink/BizLockButton';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { Avatar } from '../../../../components/ui/Avatar';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { execOutcomeBadge } from '../../../../components/executive/exec-badges';

/** Wireframe x-agentdetail — gated (ADR-007), view-only: one agent's stats, clients, meetings. */
export default function ExecutiveAgentDetailScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();

  if (!unlocked) return <SecurityGate />;

  const agent = execAgentById(agentId);
  if (!agent) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Agent not found.</Text>
      </YStack>
    );
  }

  const manager = execManagerById(agent.managerId);
  const clients = execClientsForAgent(agent.id);
  const meetings = execMeetingsForAgent(agent.id);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={agent.name.split(' ')[0]} right={<BizLockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <XStack alignItems="center" gap="$3.5" backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18}>
          <Avatar initials={agent.initials} size="lg" background={agent.avatar.background} color={agent.avatar.color} />
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>{agent.name}</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Sales Specialist · under {manager?.name ?? '—'}
            </Text>
          </YStack>
        </XStack>

        <XStack gap={10} marginTop={14}>
          <StatBox value={`${agent.meetings}`} label="Meetings" />
          <StatBox value={`${agent.clients}`} label="Clients" />
          <StatBox value={`${agent.rate}%`} label="Success rate" />
        </XStack>

        <BizSectionHeader title="Clients" />
        {clients.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">Walang clients.</Text>
        ) : null}
        {clients.map((client) => {
          const badge = CLIENT_STATUS_BADGES[client.status];
          return (
            <XStack
              key={client.id}
              alignItems="center"
              gap="$3"
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              padding={14}
              marginBottom={10}
              onPress={() => router.push(`/(executive)/clients/${client.id}`)}
            >
              <Avatar initials={client.name.slice(0, 2).toUpperCase()} size="sm" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.muted} />
              <YStack flex={1} gap="$0.5">
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.name}</Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{client.channel}</Text>
              </YStack>
              <StatusBadge {...badge} />
              <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
            </XStack>
          );
        })}

        <BizSectionHeader title="Recent meetings" />
        {meetings.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">Wala pang meetings.</Text>
        ) : null}
        {meetings.map((meeting) => (
          <XStack
            key={meeting.id}
            alignItems="center"
            gap="$3"
            backgroundColor={BIZLINK_COLORS.card}
            borderRadius={20}
            padding={14}
            marginBottom={10}
            onPress={() => router.push(`/(executive)/clients/meeting/${meeting.id}`)}
          >
            <YStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.soft}>
              <Handshake size={15} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            </YStack>
            <YStack flex={1} gap="$0.5">
              <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
                {execClientById(meeting.clientId)?.name ?? '—'}
              </Text>
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{meeting.date} · {meeting.time}</Text>
            </YStack>
            {execOutcomeBadge(meeting.outcome)}
            <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
          </XStack>
        ))}
      </ScrollView>
    </YStack>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} alignItems="center">
      <Text fontSize={20} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{value}</Text>
      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{label}</Text>
    </YStack>
  );
}
