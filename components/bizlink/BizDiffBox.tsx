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
export function BizDiffBox({ fields }: BizDiffBoxProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <BizCard gap="$3">
      {fields.map((field) => (
        <YStack key={field.label} gap="$1.5">
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>
            {field.label.toUpperCase()}
          </Text>
          <XStack
            alignItems="center"
            gap="$2.5"
            backgroundColor={BIZLINK_COLORS.soft}
            borderRadius={16}
            paddingHorizontal={14}
            paddingVertical={12}
          >
            <Text
              flex={1}
              fontSize={13}
              fontFamily={BIZLINK_FONTS.semibold}
              color={BIZLINK_COLORS.muted}
              textDecorationLine="line-through"
            >
              {field.from}
            </Text>
            <ArrowRight size={14} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text flex={1} fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
              {field.to}
            </Text>
          </XStack>
        </YStack>
      ))}
    </BizCard>
  );
}
