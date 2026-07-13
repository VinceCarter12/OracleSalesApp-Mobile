import { Text, XStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface StatListRowProps {
  label: string;
  value: number | string;
  color?: string;
  last?: boolean;
}

/** Shared label/value row for stat and report cards — used across RSR, Manager, and Executive performance/reports screens. */
export function StatListRow({ label, value, color, last }: StatListRowProps) {
  return (
    <XStack
      paddingVertical={10}
      justifyContent="space-between"
      borderBottomWidth={last ? 0 : 2}
      borderBottomColor={COLORS.polar}
    >
      <Text fontSize={13} fontWeight="700" color={COLORS.eel}>{label}</Text>
      <Text fontSize={13} fontWeight="800" color={color ?? COLORS.eel}>{value}</Text>
    </XStack>
  );
}
