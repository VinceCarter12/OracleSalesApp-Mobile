import { ChevronRight } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { LostOpportunityListItem } from '../../lib/lost-opportunity-list-service';
import { BizCard } from './BizCard';

interface BizLostOpportunityRowProps {
  item: LostOpportunityListItem;
  rowNumber: number;
  onPress: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Wireframe `aRenderLostOpportunities()` row anatomy
 * (Wireframe-Sales-BizLink.html ~line 1368): row number + company name +
 * "inactive" status pill on one line, city · channel underneath, then
 * "Lost: <date> · <reason>" as a micro line. Structurally cloned from
 * `BizMyRequestRow` per the Design-System-Catalog gap note — same card/
 * icon-badge/chevron shape, no new visual pattern invented.
 */
export function BizLostOpportunityRow({ item, rowNumber, onPress }: BizLostOpportunityRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();

  return (
    <BizCard onPress={onPress} pressStyle={{ opacity: 0.85 }} marginBottom={10} gap="$1.5">
      <XStack alignItems="center" gap="$2.5">
        <YStack
          width={26}
          height={26}
          borderRadius={18}
          backgroundColor={BIZLINK_COLORS.tintA}
          alignItems="center"
          justifyContent="center"
        >
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={12} color={BIZLINK_COLORS.ink}>
            {rowNumber}
          </Text>
        </YStack>
        <YStack flex={1} gap="$0.5">
          <XStack alignItems="center" gap="$2">
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
              {item.companyName}{' '}
              <Text fontFamily={BIZLINK_FONTS.medium} fontSize={11} color={BIZLINK_COLORS.muted}>
                Inactive
              </Text>
            </Text>
          </XStack>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {[item.city, item.channel].filter(Boolean).join(' · ') || 'No location on file'}
          </Text>
        </YStack>
        <ChevronRight size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
      </XStack>
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} flex={1}>
          Lost: {formatDate(item.lostAt)}{item.reason ? ` · ${item.reason}` : ''}
        </Text>
      </XStack>
    </BizCard>
  );
}
