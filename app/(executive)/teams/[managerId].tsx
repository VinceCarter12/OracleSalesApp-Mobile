import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useExecutiveOverview } from '../../../lib/use-executive-overview';
import { avatarPaletteFor } from '../../../lib/avatar-palette';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizLockButton } from '../../../components/bizlink/BizLockButton';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { Avatar } from '../../../components/ui/Avatar';

/** Wireframe x-managerdetail — gated (ADR-007), view-only: one manager's team stats + agent list. B-054 Phase 2: real data. */
export default function ExecutiveManagerDetailScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { managerId } = useLocalSearchParams<{ managerId: string }>();
  const { overview, loading, error, reload } = useExecutiveOverview();

  if (!unlocked) return <SecurityGate />;

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas} gap="$3" paddingHorizontal="$5">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
        <BizButton small label="Ulitin" variant="white" onPress={reload} />
      </YStack>
    );
  }

  const manager = overview?.managers.find((m) => m.id === managerId);
  if (!manager) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Manager not found.</Text>
      </YStack>
    );
  }

  const managerColor = avatarPaletteFor(manager.id);
  const agents = overview?.agents.filter((a) => a.managerId === manager.id) ?? [];

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={manager.name.split(' ')[0]} right={<BizLockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <XStack alignItems="center" gap="$3.5" backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18}>
          <Avatar initials={manager.initials} size="lg" background={managerColor.background} color={managerColor.color} />
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
            Walang agent na naka-assign sa team na ito.
          </Text>
        ) : null}
        {agents.map((agent) => {
          const color = avatarPaletteFor(agent.id);
          return (
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
              <Avatar initials={agent.initials} size="sm" background={color.background} color={color.color} />
              <YStack flex={1} gap="$0.5">
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{agent.name}</Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  {agent.clients} clients · {agent.rate}% success
                </Text>
              </YStack>
              <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
            </XStack>
          );
        })}
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
