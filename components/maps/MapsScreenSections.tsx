import { ChevronLeft, ChevronRight, MapPinned, WifiOff } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { router } from 'expo-router';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { isSameCalendarDay } from '../../lib/local-day';
import type { OfficePinClient } from '../../lib/use-office-pins';
import type { MeetingMapMarker } from '../../lib/use-meeting-map-markers';
import type { PinFilterValue, MeetingTypeFilterValue } from '../../lib/use-maps-screen';
import { BizFilterScroll, type BizFilterOption } from '../bizlink/BizFilterScroll';
import { BizOfficePinRow } from '../bizlink/BizOfficePinRow';
import { BizCard } from '../bizlink/BizCard';
import { LeafletWebViewMap, type LeafletMapMarker } from './LeafletWebViewMap';

// Batch 8 Maps extension (2026-08-04): presentational sections for
// app/(tabs)/more/maps.tsx, split out to keep that route file render-only
// and under the 300-line/40-line-function conventions
// (_meta/engineering-principles.md).

export const PIN_FILTER_OPTIONS: BizFilterOption<PinFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
];

/** Prev/next-day navigator label — "Today" is the common case, otherwise a short date. */
export function dateChipLabel(date: Date): string {
  const today = new Date();
  if (isSameCalendarDay(date.toISOString(), today.toISOString())) return 'Today';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function handleMarkerPress(id: string): void {
  const [kind, recordId] = id.split(':');
  if (kind === 'office') {
    router.push(`/(tabs)/more/office-map/${recordId}`);
  } else if (kind === 'meeting') {
    router.push(`/(tabs)/meetings/${recordId}`);
  }
}

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

export function MapSurface({ loading, markers }: { loading: boolean; markers: LeafletMapMarker[] }) {
  if (loading) {
    return (
      <YStack alignItems="center" paddingVertical="$6">
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }
  if (markers.length === 0) {
    return (
      <YStack alignItems="center" paddingVertical="$6" gap="$2" backgroundColor={BIZLINK_COLORS.card} borderRadius={24}>
        <MapPinned size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingHorizontal="$5">
          Walang pin na ipapakita sa filter na ito.
        </Text>
      </YStack>
    );
  }
  return <LeafletWebViewMap markers={markers} onMarkerPress={handleMarkerPress} height={300} />;
}

export function MapLegend() {
  return (
    <XStack gap="$4" marginTop="$2.5" paddingHorizontal="$1" flexWrap="wrap">
      <LegendItem color={BIZLINK_COLORS.brand} label="Verified office pin" />
      <LegendItem color={BIZLINK_COLORS.orange} label="Unverified office pin" />
      <LegendItem color={BIZLINK_COLORS.navy} label="Meeting GPS" />
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

interface OfficePinsSectionProps {
  filteredPins: OfficePinClient[];
  verifiedCount: number;
  loading: boolean;
  pinFilter: PinFilterValue;
  onPinFilterChange: (value: PinFilterValue) => void;
}

export function OfficePinsSection({ filteredPins, verifiedCount, loading, pinFilter, onPinFilterChange }: OfficePinsSectionProps) {
  return (
    <>
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginTop="$3" marginBottom="$1.5">
        Office pins
      </Text>
      <BizFilterScroll options={PIN_FILTER_OPTIONS} value={pinFilter} onChange={onPinFilterChange} />
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2.5" marginBottom="$1">
        {filteredPins.length} shown · {verifiedCount} verified
      </Text>
      <YStack marginTop="$2">
        {loading ? null : filteredPins.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$2">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              Walang office pin sa filter na ito.
            </Text>
          </YStack>
        ) : (
          filteredPins.map((pin) => (
            <BizOfficePinRow key={pin.id} pin={pin} onPress={() => router.push(`/(tabs)/more/office-map/${pin.id}`)} />
          ))
        )}
      </YStack>
    </>
  );
}

interface MeetingsSectionProps {
  filteredMeetingMarkers: MeetingMapMarker[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  meetingTypeFilter: MeetingTypeFilterValue;
  onMeetingTypeFilterChange: (value: MeetingTypeFilterValue) => void;
  meetingTypeOptions: BizFilterOption<MeetingTypeFilterValue>[];
}

export function MeetingsSection({
  filteredMeetingMarkers,
  selectedDate,
  onDateChange,
  meetingTypeFilter,
  onMeetingTypeFilterChange,
  meetingTypeOptions,
}: MeetingsSectionProps) {
  return (
    <>
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginTop="$4" marginBottom="$1.5">
        Meetings
      </Text>
      <DateNavigator date={selectedDate} onChange={onDateChange} />
      <YStack marginTop="$2">
        <BizFilterScroll options={meetingTypeOptions} value={meetingTypeFilter} onChange={onMeetingTypeFilterChange} />
      </YStack>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2.5">
        {filteredMeetingMarkers.length} meeting{filteredMeetingMarkers.length === 1 ? '' : 's'} sa {dateChipLabel(selectedDate).toLowerCase()}
      </Text>
    </>
  );
}

function DateNavigator({ date, onChange }: { date: Date; onChange: (date: Date) => void }) {
  return (
    <XStack alignItems="center" gap="$2" backgroundColor={BIZLINK_COLORS.card} borderRadius={999} paddingHorizontal={8} paddingVertical={6} alignSelf="flex-start">
      <View onPress={() => onChange(addDays(date, -1))} width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" pressStyle={{ opacity: 0.7 }}>
        <ChevronLeft size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
      </View>
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} minWidth={64} textAlign="center">
        {dateChipLabel(date)}
      </Text>
      <View onPress={() => onChange(addDays(date, 1))} width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" pressStyle={{ opacity: 0.7 }}>
        <ChevronRight size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
      </View>
    </XStack>
  );
}

export function PinDataBoundaryCard() {
  return (
    <BizCard flat marginTop="$3" gap="$1.5">
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
        Pin data boundary
      </Text>
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={18}>
        Read-only map ito. Verified Client Office pins lang ang permanent client location; Online at Others ay hindi
        pinagmumulan ng pin. Meeting markers ay galing sa aktwal na GPS ng bawat meeting.
      </Text>
    </BizCard>
  );
}
