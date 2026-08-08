import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizChip } from '../bizlink/BizChip';
import { MEETING_LOCATIONS, type MeetingLocationOption } from './MeetingLocationPicker';
import { MEETING_AGENDAS } from '../../types';

export type LocationFilter = 'All locations' | MeetingLocationOption;
export type AgendaFilter = 'All agendas' | (typeof MEETING_AGENDAS)[number];

export const ALL_LOCATIONS: LocationFilter = 'All locations';
export const ALL_AGENDAS: AgendaFilter = 'All agendas';

// Mirrors My Clients' SORT chips (app/(tabs)/clients/index.tsx) — same
// component pattern/placement in the Filters panel, 'newest' default to
// match. 'needs_action' has no meeting-side equivalent (that's a client
// lifecycle concept), so 'company_az' takes its slot as the second option.
export type MeetingSortOption = 'newest' | 'oldest' | 'company_az';
export const MEETING_SORT_OPTIONS: Array<{ value: MeetingSortOption; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'company_az', label: 'Company A–Z' },
];

/**
 * Meeting Details list's expandable Filters panel (Wireframe-Sales-BizLink.
 * html `#a-meetingFilterPanel`, 2026-08-04 visual-parity handoff) — the
 * wireframe's two `<select>`s (decorative there) made into real, working
 * Location/Agenda chip filters. Split out of app/(tabs)/meetings/index.tsx
 * to keep that screen file under the 300-line cap.
 */
export function MeetingFilterPanel({
  locationFilter,
  onLocationChange,
  agendaFilter,
  onAgendaChange,
  sort,
  onSortChange,
}: {
  locationFilter: LocationFilter;
  onLocationChange: (value: LocationFilter) => void;
  agendaFilter: AgendaFilter;
  onAgendaChange: (value: AgendaFilter) => void;
  sort: MeetingSortOption;
  onSortChange: (value: MeetingSortOption) => void;
}) {
  const BIZLINK_COLORS = useBizlinkColors();

  return (
    <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} gap="$3">
      <YStack gap="$1.5">
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>LOCATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            <BizChip label={ALL_LOCATIONS} selected={locationFilter === ALL_LOCATIONS} onPress={() => onLocationChange(ALL_LOCATIONS)} />
            {MEETING_LOCATIONS.map((loc) => (
              <BizChip key={loc} label={loc} selected={locationFilter === loc} onPress={() => onLocationChange(loc)} />
            ))}
          </XStack>
        </ScrollView>
      </YStack>

      <YStack gap="$1.5">
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>AGENDA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            <BizChip label={ALL_AGENDAS} selected={agendaFilter === ALL_AGENDAS} onPress={() => onAgendaChange(ALL_AGENDAS)} />
            {MEETING_AGENDAS.map((agenda) => (
              <BizChip key={agenda} label={agenda} selected={agendaFilter === agenda} onPress={() => onAgendaChange(agenda)} />
            ))}
          </XStack>
        </ScrollView>
      </YStack>

      <YStack gap="$1.5">
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>SORT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            {MEETING_SORT_OPTIONS.map((option) => (
              <BizChip key={option.value} label={option.label} selected={sort === option.value} onPress={() => onSortChange(option.value)} />
            ))}
          </XStack>
        </ScrollView>
      </YStack>
    </YStack>
  );
}
