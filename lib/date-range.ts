import type { DateRange } from '../components/bizlink/DateRangePickerModal';

/** Inclusive day-level bounds check against a `DateRangeFilterRow` selection — shared by every screen using that filter (Meetings, My Clients, Sync History). */
export function isWithinDateRange(date: Date, range: DateRange | null): boolean {
  if (!range) return true;
  const t = date.getTime();
  const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).getTime();
  const end = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59, 999).getTime();
  return t >= start && t <= end;
}
