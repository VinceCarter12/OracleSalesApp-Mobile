import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { execAgentsForManager, execManagerById } from '../../../lib/executive-data';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { TopBar } from '../../../components/ui/TopBar';
import { LockButton } from '../../../components/security/LockButton';
import { Card } from '../../../components/ui/Card';
import { SectionHeader } from '../../../components/ui/SectionHeader';

/** Wireframe x-managerdetail — gated, view-only: one manager's team stats + agent list. */
export default function ExecutiveManagerDetailScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { managerId } = useLocalSearchParams<{ managerId: string }>();

  if (!unlocked) return <SecurityGate />;

  const manager = execManagerById(managerId);
  if (!manager) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Text>Manager not found.</Text>
      </YStack>
    );
  }

  const agents = execAgentsForManager(manager.id);

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title={manager.name.split(' ')[0]} right={<LockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3.5">
          <XStack width={60} height={60} borderRadius={30} alignItems="center" justifyContent="center" backgroundColor={manager.avatar.background}>
            <Text fontWeight="800" fontSize={22} color={manager.avatar.color}>{manager.initials}</Text>
          </XStack>
          <YStack>
            <Text fontWeight="800" fontSize={17} color={COLORS.eel}>{manager.name}</Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>
              {manager.track === 'rsr' ? 'RSR Manager' : 'Sales Manager'}
            </Text>
          </YStack>
        </Card>

        <XStack gap="$2.5" marginTop="$3.5">
          <OverviewStat value={manager.meetings} label="Team meetings" color={COLORS.ledgeGreen} />
          <OverviewStat value={manager.clients} label="Team clients" color={COLORS.blue} />
          <OverviewStat value={manager.agentCount} label="Agents" color={COLORS.orange} />
        </XStack>

        <SectionHeader title="Agents sa team na ito" />
        {agents.length === 0 ? (
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} paddingVertical="$3">
            Wala pang agent records sa mock data para sa team na ito.
          </Text>
        ) : null}
        {agents.map((agent) => (
          <Pressable key={agent.id} onPress={() => router.push(`/(executive)/teams/agent/${agent.id}`)}>
            <XStack alignItems="center" gap="$3" paddingVertical={13} borderBottomWidth={2} borderBottomColor={COLORS.polar}>
              <View width={38} height={38} borderRadius={19} alignItems="center" justifyContent="center" backgroundColor={agent.avatar.background}>
                <Text fontWeight="800" fontSize={13} color={agent.avatar.color}>{agent.initials}</Text>
              </View>
              <YStack flex={1} gap="$0.5">
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{agent.name}</Text>
                <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
                  {agent.clients} clients · {agent.rate}% success
                </Text>
              </YStack>
              <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
            </XStack>
          </Pressable>
        ))}
      </ScrollView>
    </YStack>
  );
}

function OverviewStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow} borderWidth={2} borderColor={COLORS.swan} borderRadius={16} padding="$3" alignItems="center">
      <Text fontSize={22} fontWeight="800" color={color}>{value}</Text>
      <Text fontSize={10.5} fontWeight="700" color={COLORS.hare} textAlign="center">{label}</Text>
    </YStack>
  );
}
