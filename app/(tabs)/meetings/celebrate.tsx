import { router, useLocalSearchParams } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { DuoButton } from '../../../components/ui/DuoButton';

/** Wireframe a-celebrate — full-bleed green success screen after a meeting saves. */
export default function MeetingCelebrateScreen() {
  const { queued } = useLocalSearchParams<{ queued?: string }>();

  return (
    <YStack flex={1} backgroundColor={COLORS.feather} alignItems="center" justifyContent="center" gap="$4" paddingHorizontal="$6">
      <View
        width={130}
        height={130}
        borderRadius={65}
        backgroundColor="rgba(255,255,255,0.22)"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize={58} color={COLORS.snow}>✓</Text>
      </View>
      <Text fontSize={26} fontWeight="800" color={COLORS.snow} letterSpacing={0.5}>
        MEETING RECORDED!
      </Text>
      {queued !== 'false' ? (
        <XStack
          gap="$2"
          alignItems="center"
          backgroundColor="rgba(255,200,0,0.25)"
          borderWidth={2}
          borderColor={COLORS.yellow}
          borderRadius={999}
          paddingHorizontal={18}
          paddingVertical={8}
        >
          <RefreshCw size={14} color={COLORS.snow} />
          <Text fontWeight="800" fontSize={13} color={COLORS.snow}>
            Queued for sync — auto-uploads when online
          </Text>
        </XStack>
      ) : null}
      <YStack width="100%" marginTop="$5">
        <DuoButton
          label="Continue"
          variant="white"
          onPress={() => router.replace('/(tabs)')}
        />
      </YStack>
    </YStack>
  );
}
