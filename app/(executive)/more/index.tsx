import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart3, Map, PencilLine, Pin, User } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { MoreTile } from '../../../components/more/MoreTile';

/** Wireframe x-more — Executive-only features hub (walang lock: read-only aggregates). */
export default function ExecutiveMoreScreen() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>More</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3.5" lineHeight={19}>
          Executive-level lang ang mga feature na ito — hindi makikita ng manager o agent.
        </Text>
        <XStack flexWrap="wrap" gap="$3">
          <MoreTile
            icon={<Pin size={19} color={COLORS.eel} />}
            title="Lost Opportunity"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Company-wide, Admin-level view</Text>}
            onPress={() => router.push('/(executive)/more/lost-opportunity')}
          />
          <MoreTile
            icon={<PencilLine size={19} color={COLORS.eel} />}
            title="Approvals Log"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Read-only audit, lahat ng managers</Text>}
            onPress={() => router.push('/(executive)/more/approvals-log')}
          />
          <MoreTile
            icon={<BarChart3 size={19} color={COLORS.eel} />}
            title="Reports"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Company-wide, i-download lahat</Text>}
            onPress={() => router.push('/(executive)/more/reports')}
          />
          <MoreTile
            icon={<Map size={19} color={COLORS.eel} />}
            title="Maps"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Pins ng meeting locations, company-wide</Text>}
            onPress={() => router.push('/(executive)/more/maps')}
          />
          <MoreTile
            icon={<User size={19} color={COLORS.eel} />}
            title="Account & Security"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Passcode at sign out</Text>}
            onPress={() => router.push('/(executive)/more/account')}
          />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
