import { Pressable } from 'react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';

type ChipTone = 'default' | 'ok' | 'lost';

interface BizChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: ChipTone;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink `.chip`/`.tile` — pill filter/selection
 * chip. Inactive: soft gray bg, muted text. Active: dark ink fill (or
 * brand/red per tone — outcome-lost/outcome-ok in Record Meeting).
 * Replaces `SelectTile` within `app/(tabs)` for this phase.
 */
export function BizChip({ label, selected, onPress, tone = 'default', icon, fullWidth = false }: BizChipProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const SELECTED_TONE_BG: Record<ChipTone, string> = {
    default: BIZLINK_COLORS.ink,
    ok: BIZLINK_COLORS.brand,
    lost: BIZLINK_COLORS.red,
  };
  const background = selected ? SELECTED_TONE_BG[tone] : BIZLINK_COLORS.soft;
  const color = selected ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted;
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 44,
        backgroundColor: background,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        justifyContent: 'center',
      }}
    >
      <XStack gap="$1.5" alignItems="center" justifyContent={fullWidth ? 'center' : 'flex-start'}>
        {icon}
        <Text fontFamily={BIZLINK_FONTS.medium} fontSize={12.5} color={color}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}
