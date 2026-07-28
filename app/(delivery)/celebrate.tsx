import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { BizButton } from '../../components/bizlink/BizButton';

/**
 * F-007 first draft (2026-07-25): delivery success — wireframe `d-celebrate`.
 * Reached via router.replace from the Deliver PO screen. Continue pops the
 * whole stack back to the dashboard, which re-reads the mutated PO list.
 */
export default function DeliverCelebrateScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.ink} paddingTop={insets.top}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 }}>
        <YStack alignItems="center" gap="$4" width="100%">
          <View width={130} height={130} borderRadius={65} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
            <Text fontSize={54} color={BIZLINK_ON_INK.solid}>✓</Text>
          </View>
          <Text fontSize={25} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-0.5} color={BIZLINK_ON_INK.solid}>
            PO delivered!
          </Text>
          <XStack alignItems="center" gap="$2" backgroundColor={BIZLINK_ON_INK.circleFill} borderRadius={999} paddingHorizontal={18} paddingVertical={9}>
            <RefreshCw size={15} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.solid}>
              Queued for sync — auto-uploads when online
            </Text>
          </XStack>
          <YStack width="100%" marginTop={26}>
            <BizButton label="Continue" variant="white" onPress={() => router.dismissAll()} />
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
