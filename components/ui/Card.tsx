import { YStack, type YStackProps } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface CardProps extends YStackProps {
  flat?: boolean;
}

/** Wireframe .card (bordered) / .card-flat (polar background). */
export function Card({ flat = false, children, ...rest }: CardProps) {
  return (
    <YStack
      backgroundColor={flat ? COLORS.polar : COLORS.snow}
      borderWidth={flat ? 0 : 2}
      borderColor={COLORS.swan}
      borderRadius={16}
      padding="$3.5"
      {...rest}
    >
      {children}
    </YStack>
  );
}
