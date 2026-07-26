import { isSameCalendarDay } from '../local-day';
import type { Meeting } from '../../types';

export const SESSION_OVERDUE_AFTER_HOURS = 8;
export const SESSION_ABANDONED_AFTER_HOURS = 10;

export type MeetingSessionStatus = 'active' | 'overdue' | 'abandoned';

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Pure elapsed-hours tiers off `startCapturedAtIso`; `nowIso` is a parameter,
 * never `Date.now()` internally, so this stays deterministic/testable.
 *
 * Clock-skew guard: if `startCapturedAtIso` is in the future relative to
 * `nowIso` (e.g. device clock drift), elapsed hours would be negative —
 * clamp that case to 'active' rather than let it crash or spuriously read
 * as 'abandoned'.
 */
export function getSessionStatus(startCapturedAtIso: string, nowIso: string): MeetingSessionStatus {
  const elapsedMs = new Date(nowIso).getTime() - new Date(startCapturedAtIso).getTime();
  if (elapsedMs < 0) return 'active';

  const elapsedHours = elapsedMs / MS_PER_HOUR;
  if (elapsedHours >= SESSION_ABANDONED_AFTER_HOURS) return 'abandoned';
  if (elapsedHours >= SESSION_OVERDUE_AFTER_HOURS) return 'overdue';
  return 'active';
}

/**
 * Generalizes app/(tabs)/index.tsx's `countTodayInPersonVisits`: online
 * meetings never count (ADR-012); `meeting_mode` undefined is treated as
 * in-person (legacy rows, pre-dating the `meeting_mode` column). Day match
 * is by device-local calendar date via `isSameCalendarDay`.
 */
export function isValidMeetingForQuota(
  meeting: Pick<Meeting, 'meeting_mode' | 'logged_at'>,
  onDayIso: string
): boolean {
  if (meeting.meeting_mode === 'online') return false;
  return isSameCalendarDay(meeting.logged_at, onDayIso);
}
