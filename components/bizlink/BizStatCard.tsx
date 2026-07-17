import { Text, View, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

type StatTone = 'tintA' | 'white' | 'tintB';

const TONE_BG: Record<StatTone, string> = {
  tintA: BIZLINK_COLORS.tintA,
  white: BIZLINK_COLORS.card,
  tintB: BIZLINK_COLORS.tintB,
};

interface BizStatCardProps {
  value: number | string;
  label: string;
  caption: string;
  tone?: StatTone;
  minWidth?: number;
  onPress?: () => void;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink tinted stat card (Design-System-Catalog
 * §3 "Tinted stat card") — caption pill + big numeral + micro-label.
 * Replaces `components/manager/StatCard.tsx` within `app/(tabs)` for this
 * phase (that file stays untouched — still used by Manager/Executive).
 */
export function BizStatCard({ value, label, caption, tone = 'white', minWidth = 150, onPress }: BizStatCardProps) {
  const isAlarm = tone === 'tintB';
  return (
    <YStack
      onPress={onPress}
      minWidth={minWidth}
      minHeight={118}
      backgroundColor={TONE_BG[tone]}
      borderRadius={24}
      padding={16}
      shadowColor={tone === 'white' ? 'rgba(18,39,28,0.05)' : undefined}
      shadowOffset={tone === 'white' ? { width: 0, height: 1 } : undefined}
      shadowOpacity={tone === 'white' ? 1 : undefined}
      shadowRadius={tone === 'white' ? 2 : undefined}
      pressStyle={onPress ? { opacity: 0.85 } : undefined}
    >
      <View
        backgroundColor="rgba(255,255,255,0.85)"
        borderRadius={999}
        paddingHorizontal={10}
        paddingVertical={4}
        alignSelf="flex-start"
      >
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
          {caption}
        </Text>
      </View>
      <Text
        marginTop={12}
        fontSize={34}
        fontFamily={BIZLINK_FONTS.semibold}
        letterSpacing={-1}
        color={isAlarm ? BIZLINK_COLORS.red : BIZLINK_COLORS.text}
      >
        {value}
      </Text>
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={4}>
        {label}
      </Text>
    </YStack>
  );
}
