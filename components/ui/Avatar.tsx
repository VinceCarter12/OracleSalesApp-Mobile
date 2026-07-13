import { Text, View } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface AvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: { box: 36, font: 13 },
  md: { box: 44, font: 16 },
  lg: { box: 60, font: 22 },
  xl: { box: 72, font: 28 },
} as const;

/** Wireframe .avatar — green-tint circle with initials. */
export function Avatar({ initials, size = 'md' }: AvatarProps) {
  const s = SIZES[size];
  return (
    <View
      width={s.box}
      height={s.box}
      borderRadius={s.box / 2}
      backgroundColor={COLORS.greenTint}
      alignItems="center"
      justifyContent="center"
    >
      <Text fontWeight="800" fontSize={s.font} color={COLORS.ledgeGreen}>{initials}</Text>
    </View>
  );
}
