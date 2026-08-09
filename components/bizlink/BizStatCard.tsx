import { Text, View, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

type StatTone = 'tintA' | 'white' | 'tintB';

interface BizStatCardProps {
  value: number | string;
  label: string;
  // B-063: optional — omit the pill entirely rather than showing a fake/
  // non-meaningful caption when a caller has no real trend data to show.
  caption?: string;
  tone?: StatTone;
  minWidth?: number;
  onPress?: () => void;
  // 2026-08-08: tappable stat cards (Reports drill-down) need a visible
  // "this is the active filter" state — a colored ring, since the tinted
  // background alone doesn't read as selected/unselected.
  selected?: boolean;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink tinted stat card (Design-System-Catalog
 * §3 "Tinted stat card") — caption pill + big numeral + micro-label.
 * Replaces `components/manager/StatCard.tsx` within `app/(tabs)` for this
 * phase (that file stays untouched — still used by Manager/Executive).
 */
export function BizStatCard({ value, label, caption, tone = 'white', minWidth = 150, onPress, selected = false }: BizStatCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const TONE_BG: Record<StatTone, string> = {
    tintA: BIZLINK_COLORS.tintA,
    white: BIZLINK_COLORS.card,
    tintB: BIZLINK_COLORS.tintB,
  };
  // 2026-08-08 fix: the caption pill used to be a translucent white overlay
  // on every tone, which reads fine on tintA/tintB but nearly disappears on
  // a `white` card (white-on-white) — that was the "highlight" Vince flagged
  // as colliding with the card background. `white`-tone cards now get a
  // solid tinted pill instead so the caption stays legible on every tone.
  const CAPTION_BG: Record<StatTone, string> = {
    tintA: 'rgba(255,255,255,0.85)',
    white: BIZLINK_COLORS.tintA,
    tintB: 'rgba(255,255,255,0.85)',
  };
  const isAlarm = tone === 'tintB';
  return (
    <YStack
      onPress={onPress}
      flex={1}
      minWidth={minWidth}
      minHeight={118}
      backgroundColor={TONE_BG[tone]}
      borderRadius={24}
      padding={16}
      borderWidth={selected ? 2 : 0}
      borderColor={selected ? BIZLINK_COLORS.brand : 'transparent'}
      shadowColor={tone === 'white' ? 'rgba(18,39,28,0.05)' : undefined}
      shadowOffset={tone === 'white' ? { width: 0, height: 1 } : undefined}
      shadowOpacity={tone === 'white' ? 1 : undefined}
      shadowRadius={tone === 'white' ? 2 : undefined}
      pressStyle={onPress ? { opacity: 0.85 } : undefined}
    >
      {caption ? (
        <View
          backgroundColor={CAPTION_BG[tone]}
          borderRadius={999}
          paddingHorizontal={10}
          paddingVertical={4}
          alignSelf="flex-start"
        >
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>
            {caption}
          </Text>
        </View>
      ) : null}
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
