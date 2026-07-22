import { DAY_MS } from './team-remote-mappers';
import type { ClientStatus } from '../types';

// B-060 addendum, split from lib/team-remote-mappers.ts 2026-07-22
// (quality-gate fix, kept that file under the 300-line cap). Shared by both
// Manager (`app/(manager)/more/reports.tsx`) and Executive
// (`app/(executive)/more/reports.tsx`) Reports screens — same TIMEFRAMES chip
// set on both wireframes (s-reports/x-reports), so one pure implementation.

export type ReportTimeframe = 'This month' | 'Last 30 days' | 'This quarter' | 'Custom';

/**
 * Inclusive start-of-window boundary for a Reports timeframe chip. 'Custom'
 * has no date-range picker anywhere in the wireframes (chip-only, no
 * supporting UI) — falls back to `null` (all-time) until real custom-range
 * UI is designed; a deliberate tradeoff, not a bug. Both Reports screens show
 * an "(all-time)" caption next to the chips whenever this resolves to `null`
 * so the fallback is never silent.
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
  now: Date
): number {
  const start = timeframeStart(timeframe, now);
  return clients.filter((c) => {
    if (c.status !== 'new' && c.status !== 'existing') return false;
    if (!start || !c.createdAt) return true;
    return new Date(c.createdAt).getTime() >= start.getTime();
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
  now: Date
): T[] {
  const start = timeframeStart(timeframe, now);
  if (!start) return meetings;
  return meetings.filter((m) => !m.meetingDateIso || new Date(m.meetingDateIso).getTime() >= start.getTime());
}
