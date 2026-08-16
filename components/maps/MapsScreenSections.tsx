import { Pressable } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { Text, View, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { MAP_MEETING_STATUS_COLORS, MAP_OFFICE_PIN_COLOR, MAP_ORG_WIDE_PROSPECT_COLOR } from '../../lib/map-marker-colors';

// Shared maps-only presentational pieces. The route owns the single map and
// list implementation; this module intentionally contains no duplicate
// sections.

export function OfflineBanner() {
  return (
    <XStack alignItems="center" gap="$2" backgroundColor={BIZLINK_COLORS.amberSoft} borderRadius={16} paddingHorizontal={14} paddingVertical={10} marginBottom="$3">
      <WifiOff size={14} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange}>
        Offline — showing saved data only.
      </Text>
    </XStack>
  );
}

/** Shared by the Sales/RSR and Manager Maps screens for `useOrgWideProspectMarkers()`'s fetch-failure state (2026-08-16) — same amber banner shape as `OfflineBanner`, with a retry action. */
export function OrgWideProspectErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <XStack alignItems="center" gap="$2" backgroundColor={BIZLINK_COLORS.amberSoft} borderRadius={16} paddingHorizontal={14} paddingVertical={10} marginBottom="$3">
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange} flex={1}>
        {message}
      </Text>
      <Pressable onPress={onRetry} hitSlop={8}>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.orange}>Retry</Text>
      </Pressable>
    </XStack>
  );
}

export interface LegendEntry {
  color: string;
  label: string;
}

/** Appended via `extraItems` only when the org-wide prospect filter toggle is ON (2026-08-16). */
export const ORG_WIDE_PROSPECT_LEGEND_ENTRY: LegendEntry = {
  color: MAP_ORG_WIDE_PROSPECT_COLOR,
  label: 'Org-wide prospect',
};

const BASE_LEGEND_ITEMS: LegendEntry[] = [
  { color: MAP_OFFICE_PIN_COLOR, label: 'Office location' },
  { color: MAP_MEETING_STATUS_COLORS.prospect, label: 'Prospect meeting' },
  { color: MAP_MEETING_STATUS_COLORS.in_progress, label: 'In Progress meeting' },
  { color: MAP_MEETING_STATUS_COLORS.new, label: 'New meeting' },
  { color: MAP_MEETING_STATUS_COLORS.existing, label: 'Existing meeting' },
  { color: BIZLINK_COLORS.navy, label: 'Your location' },
];

/**
 * Fixed 2-column grid (not free-flowing `flexWrap` of variable-width items)
 * so every dot lands on one of two consistent x-offsets regardless of how
 * long the row-mate's label is — a `flexWrap` row of variously-sized chips
 * left the dots at ragged, unaligned x-positions (Vince, 2026-08-10).
 * `extraItems` lets manager-only maps.tsx append "Team record" into the SAME
 * grid instead of a second, separately-wrapping `XStack` sibling, which used
 * to start its own row at the far left instead of continuing the grid.
 */
export function MapLegend({ extraItems = [] }: { extraItems?: LegendEntry[] }) {
  const items = [...BASE_LEGEND_ITEMS, ...extraItems];
  return (
    <XStack flexWrap="wrap" marginTop="$2.5" paddingHorizontal="$1">
      {items.map((item) => (
        <XStack key={item.label} width="50%" alignItems="center" gap="$1.5" paddingVertical={3}>
          <View width={16} height={16} borderRadius={8} backgroundColor={item.color} />
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{item.label}</Text>
        </XStack>
      ))}
    </XStack>
  );
}

/** Exported for callers that need a single standalone legend dot+label outside the grid. */
export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <XStack alignItems="center" gap="$1.5">
      <View width={10} height={10} borderRadius={5} backgroundColor={color} />
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{label}</Text>
    </XStack>
  );
}
