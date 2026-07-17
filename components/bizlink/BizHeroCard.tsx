import { Text, View, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';

interface BizHeroCardProps {
  value: number | string;
  unit?: string;
  label: string;
  caption: string;
  onPress?: () => void;
}

/** T-014 Phase 2 (ADR-024): BizLink dark hero card — one per dashboard, `--ink` bg, 44px numeral. */
export function BizHeroCard({ value, unit, label, caption, onPress }: BizHeroCardProps) {
  return (
    <YStack
      onPress={onPress}
      backgroundColor={BIZLINK_COLORS.ink}
      borderRadius={24}
      padding={18}
      marginTop={10}
      pressStyle={onPress ? { opacity: 0.9 } : undefined}
    >
      <View
        backgroundColor={BIZLINK_ON_INK.circleFill}
        borderRadius={999}
        paddingHorizontal={11}
        paddingVertical={4}
        alignSelf="flex-end"
      >
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>
          {caption}
        </Text>
      </View>
      <Text fontSize={42} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-1.5} color={BIZLINK_COLORS.card} marginTop={10}>
        {value}
        {unit ? (
          <Text fontSize={16} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}> {unit}</Text>
        ) : null}
      </Text>
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted} marginTop={8}>
        {label}{onPress ? '  ›' : ''}
      </Text>
    </YStack>
  );
}
