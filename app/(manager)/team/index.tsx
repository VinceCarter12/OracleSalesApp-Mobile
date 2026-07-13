import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { AGENT_COLORS, getManagerAgents } from '../../../lib/manager-data';

/** Wireframe s-team — ungated: staff stats only, no client data, so no fingerprint needed. */
export default function ManagerTeamScreen() {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>My Team</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3" lineHeight={19}>
          Makikita mo dito ang lahat ng agents sa ilalim mo — kanya-kanyang stats para malaman mo kung sino ang
          kailangan ng tulong. (Staff stats lang ito — hindi customer data, kaya walang fingerprint na kailangan.)
        </Text>
        {getManagerAgents().map((agent) => {
          const c = AGENT_COLORS[agent.id];
          return (
            <XStack
              key={agent.id}
              alignItems="center"
              gap="$3"
              backgroundColor={COLORS.snow}
              borderWidth={2}
              borderColor={COLORS.swan}
              borderRadius={16}
              padding="$3.5"
              marginBottom="$2.5"
              onPress={() => router.push(`/(manager)/team/${agent.id}`)}
              pressStyle={{ opacity: 0.85 }}
            >
              <View width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={c.background}>
                <Text fontWeight="800" fontSize={16} color={c.color}>{agent.initials}</Text>
              </View>
              <YStack flex={1}>
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{agent.name}</Text>
                <XStack gap="$2.5" marginTop={3}>
                  <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf}>
                    <Text color={COLORS.ledgeGreen}>{agent.meetingsThisMonth}</Text> meetings
                  </Text>
                  <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf}>
                    <Text color={COLORS.ledgeGreen}>{agent.activeClients}</Text> clients
                  </Text>
                  <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf}>
                    <Text color={COLORS.ledgeGreen}>{agent.successRate}%</Text> success
                  </Text>
                </XStack>
              </YStack>
              <ChevronRight size={16} color={COLORS.swanLedge} />
            </XStack>
          );
        })}
      </ScrollView>
    </YStack>
  );
}
