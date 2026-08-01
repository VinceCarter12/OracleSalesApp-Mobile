import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { History, Hourglass } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizTopBar } from '../../components/bizlink/BizTopBar';

/**
 * F-007 first draft (2026-07-25): Delivery History — wireframe `d-home` leaves
 * this a stub ("draft, kasama sa OQ-5 spec pass"). Placeholder until the
 * delivery module is spec'd. The whole module is DRAFT pending spec (OQ-5).
 */
export default function DeliveryHistoryScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Delivery History" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 40 }}>
        <YStack alignItems="center" gap="$3">
          <History size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.5} />
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text} textAlign="center">
            This feature isn’t final yet
          </Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" lineHeight={19}>
            Delivery history is part of the next OQ-5 spec pass — the whole delivery module is still a draft.
          </Text>
          <YStack flexDirection="row" alignItems="center" gap="$1.5" marginTop="$1">
            <Hourglass size={14} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={12.5} color={BIZLINK_COLORS.orange}>
              Pending spec (OQ-5)
            </Text>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
