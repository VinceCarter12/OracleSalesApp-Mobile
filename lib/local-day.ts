/**
 * Same-day-only validity rule, compared by DEVICE-LOCAL calendar date.
 * `.toISOString().slice(0,10)` (the original implementation) compares UTC
 * dates instead — on a UTC+8 device a draft started at 1am local is still
 * "yesterday" in UTC until 8am local, so it was wrongly discarded as stale
 * on the very next check, while a draft started at 11pm local stayed
 * "valid" 8 hours into the next local day. `toDateString()` compares the
 * date in the runtime's local timezone, which is what "same day" means to
 * the agent holding the phone.
 */
export function isSameCalendarDay(isoA: string, isoB: string): boolean {
  return new Date(isoA).toDateString() === new Date(isoB).toDateString();
}
