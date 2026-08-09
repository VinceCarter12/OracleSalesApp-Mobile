import { XStack, YStack } from 'tamagui';
import { BizChip } from '../bizlink/BizChip';
import { BizFilterSheetRow } from '../bizlink/BizFilterSheetRow';
import { MEETING_LOCATIONS, type MeetingLocationOption } from './MeetingLocationPicker';
import { MEETING_AGENDAS, type ClientStatus } from '../../types';

export type LocationFilter = 'All locations' | MeetingLocationOption;
export type AgendaFilter = 'All agendas' | (typeof MEETING_AGENDAS)[number];
export type ClientStatusFilter = ClientStatus | 'all';

export const ALL_LOCATIONS: LocationFilter = 'All locations';
export const ALL_AGENDAS: AgendaFilter = 'All agendas';

// Same lifecycle stages as My Clients' STATUS_FILTERS (app/(tabs)/clients/
// index.tsx) — no "Inactive" chip, that status is server-side lifecycle
// only, never agent-facing (types/index.ts's CLIENT_STATUSES comment).
export const CLIENT_STATUS_FILTER_OPTIONS: Array<{ value: ClientStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
];

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
 * Meeting Details list's Filters sheet body (Wireframe-Sales-BizLink.html
 * `#a-meetingFilterPanel`, 2026-08-04 visual-parity handoff; redesigned to
 * iOS-Reminders-style accordion rows per Vince's 2026-08-08 filter-UI
 * redesign). Chip lists wrap onto multiple lines (Vince, 2026-08-08: "no
 * need na ng swipe to right para makita lahat") instead of horizontal
 * scrolling — every option is visible without swiping. "Status" filters by
 * the associated client's CURRENT lifecycle status (Vince's addition,
 * 2026-08-08), separate from "Outcome" (the meeting's own result, filtered
 * by the chip row outside this sheet). Split out of app/(tabs)/meetings/
 * index.tsx to keep that screen file under the 300-line cap.
 */
export function MeetingFilterPanel({
  locationFilter,
  onLocationChange,
  agendaFilter,
  onAgendaChange,
  clientStatusFilter,
  onClientStatusChange,
  sort,
  onSortChange,
}: {
  locationFilter: LocationFilter;
  onLocationChange: (value: LocationFilter) => void;
  agendaFilter: AgendaFilter;
  onAgendaChange: (value: AgendaFilter) => void;
  clientStatusFilter: ClientStatusFilter;
  onClientStatusChange: (value: ClientStatusFilter) => void;
  sort: MeetingSortOption;
  onSortChange: (value: MeetingSortOption) => void;
}) {
  const sortLabel = MEETING_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? sort;
  const statusLabel = CLIENT_STATUS_FILTER_OPTIONS.find((option) => option.value === clientStatusFilter)?.label ?? clientStatusFilter;

  return (
    <YStack>
      <BizFilterSheetRow label="Location" value={locationFilter}>
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label={ALL_LOCATIONS} selected={locationFilter === ALL_LOCATIONS} onPress={() => onLocationChange(ALL_LOCATIONS)} />
          {MEETING_LOCATIONS.map((loc) => (
            <BizChip key={loc} label={loc} selected={locationFilter === loc} onPress={() => onLocationChange(loc)} />
          ))}
        </XStack>
      </BizFilterSheetRow>

      <BizFilterSheetRow label="Agenda" value={agendaFilter}>
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label={ALL_AGENDAS} selected={agendaFilter === ALL_AGENDAS} onPress={() => onAgendaChange(ALL_AGENDAS)} />
          {MEETING_AGENDAS.map((agenda) => (
            <BizChip key={agenda} label={agenda} selected={agendaFilter === agenda} onPress={() => onAgendaChange(agenda)} />
          ))}
        </XStack>
      </BizFilterSheetRow>

      <BizFilterSheetRow label="Status" value={statusLabel}>
        <XStack gap="$2" flexWrap="wrap">
          {CLIENT_STATUS_FILTER_OPTIONS.map((option) => (
            <BizChip key={option.value} label={option.label} selected={clientStatusFilter === option.value} onPress={() => onClientStatusChange(option.value)} />
          ))}
        </XStack>
      </BizFilterSheetRow>

      <BizFilterSheetRow label="Sort" value={sortLabel}>
        <XStack gap="$2" flexWrap="wrap">
          {MEETING_SORT_OPTIONS.map((option) => (
            <BizChip key={option.value} label={option.label} selected={sort === option.value} onPress={() => onSortChange(option.value)} />
          ))}
        </XStack>
      </BizFilterSheetRow>
    </YStack>
  );
}
