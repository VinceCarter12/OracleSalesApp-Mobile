import { router, useLocalSearchParams } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { BizButton } from '../../../components/bizlink/BizButton';

/** Wireframe a-celebrate — full-bleed dark emerald success screen after a meeting saves. */
export default function MeetingCelebrateScreen() {
  const { queued } = useLocalSearchParams<{ queued?: string }>();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.ink} alignItems="center" justifyContent="center" gap="$4" paddingHorizontal="$6">
      <View
        width={130}
        height={130}
        borderRadius={65}
        backgroundColor={BIZLINK_ON_INK.circleFill}
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize={54} color={BIZLINK_COLORS.card}>✓</Text>
      </View>
      <Text fontSize={25} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card} letterSpacing={-0.5}>
        Meeting recorded!
      </Text>
      {queued !== 'false' ? (
        <XStack
          gap="$2"
          alignItems="center"
          backgroundColor={BIZLINK_ON_INK.circleFill}
          borderRadius={999}
          paddingHorizontal={18}
          paddingVertical={9}
        >
          <RefreshCw size={14} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
          <Text fontFamily={BIZLINK_FONTS.medium} fontSize={12.5} color={BIZLINK_COLORS.card}>
            Queued for sync — auto-uploads when online
          </Text>
        </XStack>
      ) : null}
      <YStack width="100%" marginTop="$5">
        <BizButton
          label="Continue"
          variant="white"
          onPress={() => router.replace('/(tabs)')}
        />
      </YStack>
    </YStack>
  );
}
