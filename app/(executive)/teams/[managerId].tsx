import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { execAgentsForManager, execManagerById } from '../../../lib/executive-data';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizLockButton } from '../../../components/bizlink/BizLockButton';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { Avatar } from '../../../components/ui/Avatar';

/** Wireframe x-managerdetail — gated (ADR-007), view-only: one manager's team stats + agent list. */
export default function ExecutiveManagerDetailScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { managerId } = useLocalSearchParams<{ managerId: string }>();

  if (!unlocked) return <SecurityGate />;

  const manager = execManagerById(managerId);
  if (!manager) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Manager not found.</Text>
      </YStack>
    );
  }

  const agents = execAgentsForManager(manager.id);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={manager.name.split(' ')[0]} right={<BizLockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <XStack alignItems="center" gap="$3.5" backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18}>
          <Avatar initials={manager.initials} size="lg" background={manager.avatar.background} color={manager.avatar.color} />
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>{manager.name}</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {manager.track === 'rsr' ? 'RSR Manager' : 'Sales Manager'}
            </Text>
          </YStack>
        </XStack>

        <XStack gap={10} marginTop={14}>
          <StatBox value={manager.meetings} label="Team meetings" />
          <StatBox value={manager.clients} label="Team clients" />
          <StatBox value={manager.agentCount} label="Agents" />
        </XStack>

        <BizSectionHeader title="Agents sa team na ito" />
        {agents.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">
            Wala pang agent records sa mock data para sa team na ito.
          </Text>
        ) : null}
        {agents.map((agent) => (
          <XStack
            key={agent.id}
            alignItems="center"
            gap="$3"
            backgroundColor={BIZLINK_COLORS.card}
            borderRadius={20}
            padding={14}
            marginBottom={10}
            onPress={() => router.push(`/(executive)/teams/agent/${agent.id}`)}
          >
            <Avatar initials={agent.initials} size="sm" background={agent.avatar.background} color={agent.avatar.color} />
            <YStack flex={1} gap="$0.5">
              <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{agent.name}</Text>
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                {agent.clients} clients · {agent.rate}% success
              </Text>
            </YStack>
            <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
          </XStack>
        ))}
      </ScrollView>
    </YStack>
  );
}

function StatBox({ value, label }: { value: number | string; label: string }) {
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} alignItems="center">
      <Text fontSize={20} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{value}</Text>
      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{label}</Text>
    </YStack>
  );
}
