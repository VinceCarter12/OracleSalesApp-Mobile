import { isSameCalendarDay } from './local-day';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RECENT_DAYS_THRESHOLD = 7;

/**
 * Relative-time formatting matching `Wireframe-Sales-BizLink.html`'s
 * notification feed mock strings (`aNotifications`, ~line 1223-1229): "2m
 * ago", "9m ago", "1h ago", "Yesterday", "2 days ago" / "3 days ago". The
 * wireframe's mock data is only 6 canned strings — it never actually
 * hardcodes a Tagalog "kagabi" anywhere in its JS (checked directly, not
 * assumed), so this deliberately does not invent that string; "Yesterday" is
 * the wireframe's real spec for a same-bucket case. "Just now" (<1 minute)
 * and the plain calendar-date fallback (>=7 days) are reasonable extensions
 * of the same style for real (unbounded) data, which the wireframe's 6
 * static examples never had to cover.
 *
 * "Yesterday" is calendar-day-based (reuses `isSameCalendarDay`, the same
 * device-local-date rule `lib/meeting-drafts.ts` already relies on) rather
 * than a raw 24-48h window — a timestamp from 11:58pm shown 3 minutes later
 * is "Yesterday" once past local midnight, not "58m ago".
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const diffMs = now.getTime() - then.getTime();
  if (diffMs < MINUTE_MS) return 'Just now';
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}m ago`;

  const thenIso = then.toISOString();
  const nowIso = now.toISOString();
  if (diffMs < DAY_MS && isSameCalendarDay(thenIso, nowIso)) {
    return `${Math.floor(diffMs / HOUR_MS)}h ago`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(thenIso, yesterday.toISOString())) return 'Yesterday';

  const days = Math.floor(diffMs / DAY_MS);
  if (days < RECENT_DAYS_THRESHOLD) return `${days} days ago`;

  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: then.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}
