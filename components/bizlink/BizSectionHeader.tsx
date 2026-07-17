import { Pressable } from 'react-native';
import { Text, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

interface BizSectionHeaderProps {
  title: string;
  helper?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** T-014 Phase 2 (ADR-024): BizLink `.section-h` — 15px/600 heading with optional right-side link. Replaces `SectionHeader` within `app/(tabs)`. */
export function BizSectionHeader({ title, helper, actionLabel, onAction }: BizSectionHeaderProps) {
  return (
    <XStack marginTop="$4" marginBottom="$2.5" alignItems="center" gap="$2">
      <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{title}</Text>
      {helper ? (
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{helper}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={{ marginLeft: 'auto', minHeight: 44, justifyContent: 'center' }} hitSlop={8}>
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{actionLabel} ›</Text>
        </Pressable>
      ) : null}
    </XStack>
  );
}
