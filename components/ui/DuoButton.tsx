import { useState } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Text, XStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

type DuoButtonVariant = 'green' | 'white' | 'red' | 'blue';

const VARIANTS: Record<
  DuoButtonVariant,
  { background: string; color: string; shadow: string; border?: string }
> = {
  green: { background: COLORS.feather, color: COLORS.snow, shadow: COLORS.ledgeGreen },
  white: { background: COLORS.snow, color: COLORS.eel, shadow: COLORS.swan, border: COLORS.swan },
  red: { background: COLORS.red, color: COLORS.snow, shadow: COLORS.ledgeRed },
  blue: { background: COLORS.blue, color: COLORS.snow, shadow: '#08213D' },
};

interface DuoButtonProps {
  label: string;
  onPress: () => void;
  variant?: DuoButtonVariant;
  disabled?: boolean;
  small?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Wireframe .btn — 3D pressed shadow (0 4px 0), uppercase 800-weight label. */
export function DuoButton({
  label,
  onPress,
  variant = 'green',
  disabled = false,
  small = false,
  icon,
  style,
}: DuoButtonProps) {
  const [pressed, setPressed] = useState(false);
  const v = VARIANTS[variant];
  const shadowHeight = pressed ? 0 : 4;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        {
          height: small ? 42 : 50,
          borderRadius: small ? 12 : 16,
          backgroundColor: v.background,
          borderWidth: v.border ? 2 : 0,
          borderColor: v.border,
          borderBottomWidth: shadowHeight + (v.border ? 2 : 0),
          borderBottomColor: v.shadow,
          marginTop: pressed ? 4 : 0,
          opacity: disabled ? 0.4 : 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <XStack gap="$2" alignItems="center">
        {icon}
        <Text
          color={v.color}
          fontWeight="800"
          fontSize={small ? 12.5 : 14}
          letterSpacing={0.5}
          textTransform="uppercase"
        >
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}
