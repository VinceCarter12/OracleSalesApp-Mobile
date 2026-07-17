import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Text, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

type BizButtonVariant = 'brand' | 'white' | 'red' | 'navy';

const VARIANTS: Record<BizButtonVariant, { background: string; color: string }> = {
  brand: { background: BIZLINK_COLORS.brand, color: BIZLINK_COLORS.card },
  white: { background: BIZLINK_COLORS.card, color: BIZLINK_COLORS.text },
  red: { background: BIZLINK_COLORS.red, color: BIZLINK_COLORS.card },
  navy: { background: BIZLINK_COLORS.navy, color: BIZLINK_COLORS.card },
};

interface BizButtonProps {
  label: string;
  onPress: () => void;
  variant?: BizButtonVariant;
  disabled?: boolean;
  small?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink `.btn` — flat pill (radius 999, no 3D
 * ledge shadow), sentence case, 600 weight. Replaces `DuoButton` within
 * `app/(tabs)` for this phase; Manager/Executive keep `DuoButton` until
 * their own phases (out of scope).
 */
export function BizButton({ label, onPress, variant = 'brand', disabled = false, small = false, icon, style }: BizButtonProps) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          height: small ? 44 : 52,
          borderRadius: 999,
          backgroundColor: v.background,
          opacity: disabled ? 0.4 : 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <XStack gap="$2" alignItems="center">
        {icon}
        <Text color={v.color} fontFamily={BIZLINK_FONTS.semibold} fontSize={small ? 13 : 15}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}
