import type { BizFilterOption } from '../components/bizlink/BizFilterScroll';
import type { DateRange } from '../components/bizlink/DateRangePickerModal';

// Shared by app/(tabs)/more/maps.tsx and app/(manager)/more/maps.tsx — pure
// date-preset helpers, split out so the manager screen (which additionally
// needs team-scope wiring) can reuse this logic instead of duplicating it.

export type MapsDatePreset = 'today' | 'last7' | 'last30' | 'custom';

export const MAPS_DATE_PRESET_OPTIONS: BizFilterOption<MapsDatePreset>[] = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

export function makeMapsPresetRange(preset: Exclude<MapsDatePreset, 'custom'>): DateRange {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (preset === 'today' ? 0 : preset === 'last7' ? 6 : 29));
  return { start, end };
}

export function toMapsDateWindow(range: DateRange | null): { startAt?: string; endAtExclusive?: string } | undefined {
  if (!range) return undefined;
  const end = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() + 1);
  return {
    startAt: new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).toISOString(),
    endAtExclusive: end.toISOString(),
  };
}
