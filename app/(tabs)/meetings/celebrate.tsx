import { router, useLocalSearchParams } from 'expo-router';
import { CloudUpload, RefreshCw } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { BizButton } from '../../../components/bizlink/BizButton';

/**
 * Wireframe a-celebrate — full-bleed dark emerald success screen after a
 * meeting saves.
 *
 * B-026: the "Queued for sync — auto-uploads when online" chip used to show
 * unconditionally — `queued` was declared as a param but no caller ever
 * actually passed it, so an agent who was ONLINE the whole time still saw
 * "offline queued" copy, which read as wrong/confusing. Callers now check
 * real connectivity (`lib/sync/connectivity.ts`) right before navigating
 * here and pass `online=true|false` — this doesn't guarantee the background
 * push has actually finished by the time this screen renders, but it
 * correctly distinguishes "you're online, this is uploading now" from
 * "you're offline, this is genuinely waiting."
 */
export default function MeetingCelebrateScreen() {
  const { online } = useLocalSearchParams<{ online?: string }>();
  const isOnline = online === 'true';

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
      <XStack
        gap="$2"
        alignItems="center"
        backgroundColor={BIZLINK_ON_INK.circleFill}
        borderRadius={999}
        paddingHorizontal={18}
        paddingVertical={9}
      >
        {isOnline ? (
          <>
            <CloudUpload size={14} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
            <Text fontFamily={BIZLINK_FONTS.medium} fontSize={12.5} color={BIZLINK_COLORS.card}>
              Online — ni-sync na o sina-sync na ngayon
            </Text>
          </>
        ) : (
          <>
            <RefreshCw size={14} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
            <Text fontFamily={BIZLINK_FONTS.medium} fontSize={12.5} color={BIZLINK_COLORS.card}>
              Queued for sync — auto-uploads when online
            </Text>
          </>
        )}
      </XStack>
      <YStack width="100%" marginTop="$5">
        <BizButton
          label="Continue"
          variant="white"
          onPress={() => {
            // `router.replace('/(tabs)')` alone only swaps the visible
            // screen — it leaves this tab's own stack (select-client →
            // record/record-visit → celebrate) intact underneath, so
            // re-tapping the Meetings tab later lands back on this stale
            // stack instead of the Meetings list. `dismissAll()` collapses
            // this tab's stack to its root first, so the Meetings tab is
            // fresh by the time the agent switches back to it.
            router.dismissAll();
            router.replace('/(tabs)');
          }}
        />
      </YStack>
    </YStack>
  );
}
