import { Pressable } from 'react-native';
import { Text, View, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';

interface BizPrimaryActionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Wireframe `.primary-action.alt` — light tint-a fill instead of the dark ink fill. */
  variant?: 'dark' | 'alt';
}

/**
 * Wireframe-Sales-BizLink.html `.primary-action` (a-home "Mga Gawain"): the
 * two dominant wide action cards above the secondary "Iba pang gawain" grid.
 * Two per row (grid-template-columns 1fr 1fr in the wireframe CSS), 94dp min
 * height, icon-in-circle + bold title + muted subtitle, left-aligned.
 */
export function BizPrimaryActionCard({ icon, title, subtitle, onPress, variant = 'dark' }: BizPrimaryActionCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const isAlt = variant === 'alt';
  const bg = isAlt ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.ink;
  const fg = isAlt ? BIZLINK_COLORS.ink : BIZLINK_ON_INK.solid;
  const iconBg = isAlt ? 'rgba(0,91,54,0.12)' : 'rgba(255,255,255,0.16)';

  return (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 44 }}>
      <YStack
        backgroundColor={bg}
        borderRadius={22}
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
    </Pressable>
  );
}
