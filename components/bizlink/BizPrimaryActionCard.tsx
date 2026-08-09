import { Animated, Pressable } from 'react-native';
import { Text, View, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { usePulseGlow } from '../../lib/use-pulse-glow';

interface BizPrimaryActionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Wireframe `.primary-action.alt` — light tint-a fill instead of the dark ink fill. */
  variant?: 'dark' | 'alt';
  /**
   * 2026-08-09 (Vince direction): a meeting keeps running in the background
   * (meeting_drafts) after the agent leaves Record Meeting — this card is
   * the "on meeting" indicator, a slow pulsing glow ring, so the agent
   * always has a glanceable reminder it's still going without a separate
   * banner. Purely visual — does not affect `onPress`/navigation.
   */
  active?: boolean;
}

/**
 * Wireframe-Sales-BizLink.html `.primary-action` (a-home "Mga Gawain"): the
 * two dominant wide action cards above the secondary "Iba pang gawain" grid.
 * Two per row (grid-template-columns 1fr 1fr in the wireframe CSS), 94dp min
 * height, icon-in-circle + bold title + muted subtitle, left-aligned.
 */
export function BizPrimaryActionCard({ icon, title, subtitle, onPress, variant = 'dark', active = false }: BizPrimaryActionCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const isAlt = variant === 'alt';
  const bg = isAlt ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.ink;
  const fg = isAlt ? BIZLINK_COLORS.ink : BIZLINK_ON_INK.solid;
  const iconBg = isAlt ? 'rgba(0,91,54,0.12)' : 'rgba(255,255,255,0.16)';

  const pulse = usePulseGlow(active);
  const borderColor = pulse.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,91,54,0.15)', BIZLINK_COLORS.brand] });
  const shadowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.45] });

  return (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 44 }}>
      <Animated.View
        style={
          active
            ? {
                borderRadius: 22,
                borderWidth: 2,
                borderColor,
                shadowColor: BIZLINK_COLORS.brand,
                shadowOpacity,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
                elevation: 4,
              }
            : undefined
        }
      >
        <YStack
          backgroundColor={bg}
          borderRadius={active ? 20 : 22}
          padding={14}
          minHeight={94}
          justifyContent="center"
        >
          <View
            width={38}
            height={38}
            borderRadius={19}
            backgroundColor={iconBg}
            alignItems="center"
            justifyContent="center"
            marginBottom={12}
          >
            {icon}
          </View>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={fg}>
            {title}
          </Text>
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={fg} opacity={0.72} marginTop={2}>
            {subtitle}
          </Text>
        </YStack>
      </Animated.View>
    </Pressable>
  );
}
