import { ArrowRight } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizCard } from './BizCard';

export interface DiffField {
  label: string;
  from: string;
  to: string;
}

export interface BizDiffBoxProps {
  fields: DiffField[];
  /**
   * 'card' (default) is the detail screen's standalone block.
   *
   * 'inline' drops the surrounding BizCard and tightens the type, for use
   * INSIDE another card — the Requests inbox row renders the diff on the row
   * itself so a manager can see what a request actually changes without
   * opening it, which is the whole point of being able to approve several at
   * once. A BizCard nested in a BizCard would double the 18px padding and
   * read as a box in a box.
   *
   * Both variants still render every field together in ONE block, so Vince's
   * bundling rule below is unaffected — the rule is about never splitting a
   * request into one card PER FIELD, not about always having a card.
   */
  variant?: 'card' | 'inline';
}

/**
 * Design-System-Catalog §"Needed before implementation" BizDiffBox —
 * Vince's explicit bundling rule (ADR-052 section J item 4 / Sprint.md
 * "BizDiffBox shows all changed fields together"): "one request per client
 * per save, all changed fields together, never per-field, never
 * cross-client." This renders EVERY field in `fields` inside ONE `BizCard` —
 * never one card per field — with each field's from/to as a
 * `Wireframe-Manager-BizLink.html` `.diffbox` (soft background, line
 * 315-318) row inside it.
 */
export function BizDiffBox({ fields, variant = 'card' }: BizDiffBoxProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const inline = variant === 'inline';

  const rows = fields.map((field) => (
    <YStack key={field.label} gap={inline ? '$1' : '$1.5'}>
      <Text
        fontSize={inline ? 10 : 11}
        fontFamily={BIZLINK_FONTS.medium}
        color={BIZLINK_COLORS.muted}
        letterSpacing={0.4}
      >
        {field.label.toUpperCase()}
      </Text>
      <XStack
        alignItems="center"
        gap={inline ? '$2' : '$2.5'}
        backgroundColor={BIZLINK_COLORS.soft}
        borderRadius={inline ? 12 : 16}
        paddingHorizontal={inline ? 10 : 14}
        paddingVertical={inline ? 8 : 12}
      >
        <Text
          flex={1}
          fontSize={inline ? 12 : 13}
          fontFamily={BIZLINK_FONTS.semibold}
          color={BIZLINK_COLORS.muted}
          textDecorationLine="line-through"
          numberOfLines={inline ? 2 : undefined}
        >
          {field.from}
        </Text>
        <ArrowRight size={inline ? 12 : 14} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
        <Text
          flex={1}
          fontSize={inline ? 12 : 13}
          fontFamily={BIZLINK_FONTS.semibold}
          color={BIZLINK_COLORS.text}
          numberOfLines={inline ? 2 : undefined}
        >
          {field.to}
        </Text>
      </XStack>
    </YStack>
  ));

  if (inline) return <YStack gap="$2">{rows}</YStack>;
  return <BizCard gap="$3">{rows}</BizCard>;
}
