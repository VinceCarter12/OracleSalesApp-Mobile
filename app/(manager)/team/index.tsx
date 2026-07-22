import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useTeamOverview } from '../../../lib/use-team-overview';
import { avatarPaletteFor } from '../../../lib/avatar-palette';
import { BizButton } from '../../../components/bizlink/BizButton';
import { Avatar } from '../../../components/ui/Avatar';

/** Wireframe s-team — ungated: staff stats only, no client data, so no fingerprint needed. Real data (B-054 Phase 1). */
export default function ManagerTeamScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useTeamOverview();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={21} color={BIZLINK_COLORS.text}>My Team</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Makikita mo dito ang lahat ng agents sa ilalim mo — kanya-kanyang stats para malaman mo kung sino ang
          kailangan ng tulong. (Staff stats lang ito — hindi customer data, kaya walang fingerprint na kailangan.)
        </Text>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {error}
            </Text>
            <BizButton small label="Ulitin" variant="white" onPress={reload} />
          </YStack>
        ) : !overview || overview.agents.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Walang agent na naka-assign sa team mo.
            </Text>
          </YStack>
        ) : (
          overview.agents.map((agent) => {
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
                onPress={() => router.push(`/(manager)/team/${agent.id}`)}
                pressStyle={{ opacity: 0.85 }}
              >
                <Avatar initials={agent.initials} background={color.background} color={color.color} />
                <YStack flex={1}>
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{agent.name}</Text>
                  <XStack gap="$2.5" marginTop={3}>
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                      <Text color={BIZLINK_COLORS.brand}>{agent.meetingsThisMonth}</Text> meetings
                    </Text>
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                      <Text color={BIZLINK_COLORS.brand}>{agent.activeClients}</Text> clients
                    </Text>
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                      <Text color={BIZLINK_COLORS.brand}>{agent.successRate}%</Text> success
                    </Text>
                  </XStack>
                </YStack>
                <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
              </XStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
