import { WifiOff } from 'lucide-react-native';
import { Text, View, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { MAP_MEETING_STATUS_COLORS, MAP_OFFICE_PIN_COLOR } from '../../lib/map-marker-colors';

// Shared maps-only presentational pieces. The route owns the single map and
// list implementation; this module intentionally contains no duplicate
// sections.

export function OfflineBanner() {
  return (
    <XStack alignItems="center" gap="$2" backgroundColor={BIZLINK_COLORS.amberSoft} borderRadius={16} paddingHorizontal={14} paddingVertical={10} marginBottom="$3">
      <WifiOff size={14} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange}>
        Offline — cached na data lang ang ipinapakita.
      </Text>
    </XStack>
  );
}

export function MapLegend() {
  return (
    <XStack gap="$4" marginTop="$2.5" paddingHorizontal="$1" flexWrap="wrap">
      <LegendItem color={MAP_OFFICE_PIN_COLOR} label="Office pin" />
      <LegendItem color={MAP_MEETING_STATUS_COLORS.prospect} label="Prospect meeting" />
      <LegendItem color={MAP_MEETING_STATUS_COLORS.in_progress} label="In Progress meeting" />
      <LegendItem color={MAP_MEETING_STATUS_COLORS.new} label="New meeting" />
      <LegendItem color={MAP_MEETING_STATUS_COLORS.existing} label="Existing meeting" />
      <LegendItem color={BIZLINK_COLORS.navy} label="You here" />
    </XStack>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <XStack alignItems="center" gap="$1.5">
      <View width={10} height={10} borderRadius={5} backgroundColor={color} />
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{label}</Text>
    </XStack>
  );
}
