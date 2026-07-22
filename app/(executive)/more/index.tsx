import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart3, Map, PencilLine, Pin, User } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { BizMoreTile } from '../../../components/bizlink/BizMoreTile';

/** Wireframe x-more — Executive-only features hub (walang lock: read-only aggregates). */
export default function ExecutiveMoreScreen() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={21} color={BIZLINK_COLORS.text}>More</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3.5" lineHeight={19}>
          Executive-level lang ang mga feature na ito — hindi makikita ng manager o agent.
        </Text>
        <XStack flexWrap="wrap" gap="$3">
          <BizMoreTile
            icon={<Pin size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Lost Opportunity"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Company-wide, Admin-level view</Text>}
            onPress={() => router.push('/(executive)/more/lost-opportunity')}
          />
          <BizMoreTile
            icon={<PencilLine size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Tag-Along Log"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Read-only decision history, company-wide</Text>}
            onPress={() => router.push('/(executive)/more/approvals-log')}
          />
          <BizMoreTile
            icon={<BarChart3 size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Reports"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Company-wide, i-download lahat</Text>}
            onPress={() => router.push('/(executive)/more/reports')}
          />
          <BizMoreTile
            icon={<Map size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Maps"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Pins ng meeting locations, company-wide</Text>}
            onPress={() => router.push('/(executive)/more/maps')}
          />
          <BizMoreTile
            icon={<User size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Account & Security"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Deactivate account (kill switch)</Text>}
            onPress={() => router.push('/(executive)/more/account')}
          />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
