import { Pressable } from 'react-native';
import { Text, XStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface SectionHeaderProps {
  title: string;
  helper?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Wireframe .section-h — 16px 800-weight heading with optional right-side link. */
export function SectionHeader({ title, helper, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <XStack marginTop="$4" marginBottom="$2.5" alignItems="center" gap="$2">
      <Text fontSize={16} fontWeight="800" color={COLORS.eel}>{title}</Text>
      {helper ? (
        <Text fontSize={13} fontWeight="700" color={COLORS.hare}>{helper}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={{ marginLeft: 'auto' }}>
          <Text fontSize={12} fontWeight="800" color={COLORS.blue}>{actionLabel} ›</Text>
        </Pressable>
      ) : null}
    </XStack>
  );
}
