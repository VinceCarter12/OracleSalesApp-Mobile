import { Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface BizDashboardAlertProps {
  /** `red` = 1-month prospect deadline; `amber` = pending manager tag-along (F-204); `green` = meeting in progress (2026-08-04), same tint as the in-screen "Meeting in progress" banner. */
  tone: 'red' | 'amber' | 'green';
  icon: React.ReactNode;
  title: string;
  caption: string;
  onPress: () => void;
}

/**
 * F-204: shared dashboard alert banner — extracted from the near-duplicate
 * "prospects need completing" (red) and "waiting for manager approval"
 * (amber) rows on the agent home screen so both share one markup/style path.
 */
export function BizDashboardAlert({ tone, icon, title, caption, onPress }: BizDashboardAlertProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const background = tone === 'red' ? BIZLINK_COLORS.tintB : tone === 'amber' ? BIZLINK_COLORS.amberSoft : BIZLINK_COLORS.tintA;
  const foreground = tone === 'red' ? BIZLINK_COLORS.red : tone === 'amber' ? BIZLINK_COLORS.orange : BIZLINK_COLORS.ink;
  return (
    <Pressable onPress={onPress} style={{ minHeight: 44 }}>
      <XStack
        alignItems="center"
        gap="$2.5"
        backgroundColor={background}
        borderRadius={24}
        paddingHorizontal={16}
        paddingVertical={14}
        marginTop={10}
      >
        {icon}
        <YStack flex={1}>
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={foreground}>{title}</Text>
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={foreground}>{caption}</Text>
        </YStack>
      </XStack>
    </Pressable>
  );
}
