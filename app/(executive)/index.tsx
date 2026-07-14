import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart3, Bell, Building2, Handshake, Magnet, Map, Pin, Users } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
import { EXEC_AGENTS, EXEC_LOST_OPP, EXEC_MANAGERS } from '../../lib/executive-data';
import { StatCard } from '../../components/manager/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { QuickAction } from '../../components/home/QuickAction';

/** Wireframe x-home — company-wide metrics across BOTH tracks (Sales + RSR), view-only. */
export default function ExecutiveHomeScreen() {
  const insets = useSafeAreaInsets();
  const totalMeetings = EXEC_MANAGERS.reduce((sum, m) => sum + m.meetings, 0);
  const totalClients = EXEC_MANAGERS.reduce((sum, m) => sum + m.clients, 0);
  const totalAgents = EXEC_MANAGERS.reduce((sum, m) => sum + m.agentCount, 0);

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <View width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={COLORS.purpleSoft}>
          <Text fontWeight="800" fontSize={16} color={COLORS.purple}>EX</Text>
        </View>
        <YStack gap="$1">
          <Text fontWeight="800" fontSize={15.5} color={COLORS.eel}>Executive Dashboard</Text>
          <StatusBadge label="Executive" background={COLORS.purpleSoft} color={COLORS.purple} />
        </YStack>
        <Pressable onPress={() => router.push('/(executive)/more/approvals-log')} style={{ marginLeft: 'auto' }}>
          <View width={40} height={40} borderRadius={20} backgroundColor={COLORS.polar} alignItems="center" justifyContent="center">
            <Bell size={17} color={COLORS.eel} />
          </View>
        </Pressable>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
          <StatCard
            icon={<Magnet size={15} color={COLORS.blue} />}
            iconBackground={COLORS.blueSoft}
            value={42}
            label="Total Prospects"
            delta="+7 this week"
            onPress={() => router.push('/(executive)/clients')}
          />
          <StatCard
            icon={<Building2 size={15} color={COLORS.ledgeGreen} />}
            iconBackground={COLORS.greenTint}
            value={totalClients}
            label="Total Clients"
            delta="+14 vs last mo."
            onPress={() => router.push('/(executive)/clients')}
          />
          <StatCard
            icon={<Handshake size={15} color={COLORS.orange} />}
            iconBackground={COLORS.amberSoft}
            value={totalMeetings}
            label="Company Meetings"
            delta="89 successful"
            onPress={() => router.push('/(executive)/more/reports')}
          />
          <StatCard
            icon={<Users size={15} color={COLORS.purple} />}
            iconBackground={COLORS.purpleSoft}
            value={EXEC_MANAGERS.length}
            label="Teams / Managers"
            delta={`${totalAgents || EXEC_AGENTS.length} agents total`}
            onPress={() => router.push('/(executive)/teams')}
          />
        </ScrollView>

        <SectionHeader title="Company Overview" actionLabel="Reports" onAction={() => router.push('/(executive)/more/reports')} />
        <XStack gap="$2.5">
          <YStack
            flex={1}
            backgroundColor={COLORS.feather}
            borderRadius={16}
            padding="$3.5"
            onPress={() => router.push('/(executive)/more/reports')}
            pressStyle={{ opacity: 0.9 }}
          >
            <XStack alignItems="center" gap="$1.5">
              <Handshake size={13} color={COLORS.snow} />
              <Text fontSize={11.5} fontWeight="800" color={COLORS.snow} opacity={0.95}>Meetings</Text>
            </XStack>
            <Text fontSize={26} fontWeight="800" color={COLORS.snow} marginTop={4}>{totalMeetings}</Text>
            <Text fontSize={11} fontWeight="700" color={COLORS.snow} opacity={0.9}>89 successful</Text>
          </YStack>
          <YStack
            flex={1}
            backgroundColor={COLORS.snow}
            borderWidth={2}
            borderColor={COLORS.swan}
            borderRadius={16}
            padding="$3.5"
            onPress={() => router.push('/(executive)/more/lost-opportunity')}
            pressStyle={{ opacity: 0.9 }}
          >
            <XStack alignItems="center" gap="$1.5">
              <Pin size={13} color={COLORS.wolf} />
              <Text fontSize={11.5} fontWeight="800" color={COLORS.wolf}>Lost Opportunities</Text>
            </XStack>
            <Text fontSize={26} fontWeight="800" color={COLORS.ledgeRed} marginTop={4}>{EXEC_LOST_OPP.length}</Text>
            <Text fontSize={11} fontWeight="700" color={COLORS.hare}>Company-wide</Text>
          </YStack>
        </XStack>

        <SectionHeader title="Teams" actionLabel="Tingnan lahat" onAction={() => router.push('/(executive)/teams')} />
        {EXEC_MANAGERS.map((manager) => (
          <Pressable key={manager.id} onPress={() => router.push(`/(executive)/teams/${manager.id}`)}>
            <XStack alignItems="center" gap="$3" paddingVertical={13} borderBottomWidth={2} borderBottomColor={COLORS.polar}>
              <View width={38} height={38} borderRadius={19} alignItems="center" justifyContent="center" backgroundColor={manager.avatar.background}>
                <Text fontWeight="800" fontSize={13} color={manager.avatar.color}>{manager.initials}</Text>
              </View>
              <YStack flex={1} gap="$0.5">
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{manager.name}</Text>
                <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
                  {manager.agentCount} agents · {manager.clients} clients
                </Text>
              </YStack>
              <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
            </XStack>
          </Pressable>
        ))}

        <SectionHeader title="Quick Actions" />
        <XStack gap="$2.5" flexWrap="wrap">
          <QuickAction icon={<Users size={16} color={COLORS.ledgeGreen} />} label="Teams" onPress={() => router.push('/(executive)/teams')} />
          <QuickAction icon={<Building2 size={16} color={COLORS.ledgeGreen} />} label="Clients" onPress={() => router.push('/(executive)/clients')} />
          <QuickAction icon={<Map size={16} color={COLORS.ledgeGreen} />} label="Maps" onPress={() => router.push('/(executive)/more/maps')} />
          <QuickAction icon={<BarChart3 size={16} color={COLORS.ledgeGreen} />} label="Reports" onPress={() => router.push('/(executive)/more/reports')} />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
