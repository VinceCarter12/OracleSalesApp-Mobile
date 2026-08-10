import { DAY_MS } from './team-remote-mappers';
import type { ClientStatus } from '../types';

// B-060 addendum, split from lib/team-remote-mappers.ts 2026-07-22
// (quality-gate fix, kept that file under the 300-line cap). Shared by both
// Manager (`app/(manager)/more/reports.tsx`) and Executive
// (`app/(executive)/more/reports.tsx`) Reports screens — same TIMEFRAMES chip
// set on both wireframes (s-reports/x-reports), so one pure implementation.

export type ReportTimeframe = 'This month' | 'Last 30 days' | 'This quarter' | 'Custom';

/**
 * User-picked bounds for the 'Custom' timeframe. Either end may be `null` when
 * the user has only filled one side; a `null` bound is simply not applied
 * (open-ended on that side). Both `null` = all-time, same as the pre-picker
 * fallback below. The Executive Reports screen now supplies a lightweight
 * from/to UI (2026-08-10); Manager still passes nothing and keeps the
 * all-time behavior.
 */
export interface CustomDateRange {
  start: Date | null;
  end: Date | null;
}

/** Inclusive `[start, end]` window (either bound `null` = open-ended on that side). */
export interface ResolvedTimeframe {
  start: Date | null;
  end: Date | null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Inclusive start-of-window boundary for a Reports timeframe chip. 'Custom'
 * has no fixed start — it comes from `CustomDateRange` via `resolveTimeframe()`
 * instead — so this returns `null` for it (all-time when no picker range is
 * set). Kept as the single source of truth for the three fixed chips.
 */
export function timeframeStart(timeframe: ReportTimeframe, now: Date): Date | null {
  switch (timeframe) {
    case 'This month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'Last 30 days':
      return new Date(now.getTime() - 30 * DAY_MS);
    case 'This quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case 'Custom':
      return null;
  }
}

/**
 * Resolves any timeframe chip to an inclusive `{ start, end }` window. The
 * three fixed chips have a computed start and no end (open-ended to now);
 * 'Custom' uses the supplied `CustomDateRange`, snapped to whole-day bounds
 * (start-of-day / end-of-day) so a same-day from==to range still includes
 * that day's meetings. Both bounds `null` = all-time.
 */
export function resolveTimeframe(
  timeframe: ReportTimeframe,
  now: Date,
  custom?: CustomDateRange
): ResolvedTimeframe {
  if (timeframe === 'Custom') {
    return {
      start: custom?.start ? startOfDay(custom.start) : null,
      end: custom?.end ? endOfDay(custom.end) : null,
    };
  }
  return { start: timeframeStart(timeframe, now), end: null };
}

/** True when `iso` falls inside the inclusive `[start, end]` window (missing `iso` always passes — see mock-fixture note on `filterMeetingsByTimeframe`). */
function isWithin(iso: string | undefined, start: Date | null, end: Date | null): boolean {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}

/**
 * Reports screens' "New clients acquired" stat — count of clients whose
 * status is new/existing AND whose `createdAt` falls within the selected
 * timeframe. `clients` has no separate status-transition timestamp, so
 * `created_at` (via `TeamClient.createdAt`/`ExecClient.createdAt`) is used as
 * an acceptable proxy — tradeoff: a client created long ago but only
 * recently promoted to new/existing (ADR-027's automatic prospect->new
 * transition) is counted in its creation window, not its promotion window.
 */
export function countNewClientsAcquired(
  clients: { status: ClientStatus; createdAt?: string }[],
  timeframe: ReportTimeframe,
  now: Date,
  custom?: CustomDateRange
): number {
  const { start, end } = resolveTimeframe(timeframe, now, custom);
  return clients.filter((c) => {
    if (c.status !== 'new' && c.status !== 'existing') return false;
    return isWithin(c.createdAt, start, end);
  }).length;
}

/**
 * Quality-gate fix (2026-07-22): Reports screens' "Total meetings" /
 * "Successful" / "Lost opportunities" stats previously ignored the selected
 * Timeframe chip entirely (always all-time), while "New clients acquired"
 * was the only one scoped — misleading, since all four stats visually
 * appear to belong to the same selected period. Scopes any meeting list
 * carrying a `meetingDateIso` (set by `lib/team-remote-mappers.ts`'s real
 * read path — see `TeamMeeting.meetingDateIso`/`ExecMeeting.meetingDateIso`)
 * to the same `timeframeStart()` boundary `countNewClientsAcquired()` uses,
 * so all four stats are consistent. Meetings with no `meetingDateIso` (mock
 * fixtures only, never the real read path) pass through unfiltered rather
 * than being silently dropped.
 */
export function filterMeetingsByTimeframe<T extends { meetingDateIso?: string }>(
  meetings: T[],
  timeframe: ReportTimeframe,
  now: Date,
  custom?: CustomDateRange
): T[] {
  const { start, end } = resolveTimeframe(timeframe, now, custom);
  if (!start && !end) return meetings;
  return meetings.filter((m) => isWithin(m.meetingDateIso, start, end));
}
