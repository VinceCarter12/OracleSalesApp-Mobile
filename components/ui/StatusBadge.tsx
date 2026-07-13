import { Text } from 'tamagui';

interface StatusBadgeProps {
  label: string;
  background: string;
  color: string;
}

/** Wireframe .badge — pill, 10.5px, 800 weight. Pass styles from CLIENT_STATUS_BADGES / OUTCOME_BADGE_STYLES. */
export function StatusBadge({ label, background, color }: StatusBadgeProps) {
  return (
    <Text
      fontSize={10.5}
      fontWeight="800"
      paddingHorizontal={10}
      paddingVertical={3}
      borderRadius={999}
      backgroundColor={background}
      color={color}
      alignSelf="flex-start"
    >
      {label}
    </Text>
  );
}
