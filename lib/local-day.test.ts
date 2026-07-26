import { describe, expect, it } from 'vitest';
import { isSameCalendarDay } from './local-day';

// Built from local Date components (not hardcoded UTC 'Z' strings) so these
// cases hold regardless of the machine/CI runner's timezone.
function localIso(year: number, month: number, day: number, hour: number, minute = 0, second = 0): string {
  return new Date(year, month, day, hour, minute, second).toISOString();
}

describe('isSameCalendarDay', () => {
  it('returns true for two timestamps on the same local calendar day', () => {
    expect(isSameCalendarDay(localIso(2026, 6, 26, 1), localIso(2026, 6, 26, 23))).toBe(true);
  });

  it('returns false for timestamps on different calendar days', () => {
    expect(isSameCalendarDay(localIso(2026, 6, 25, 23, 59), localIso(2026, 6, 26, 0, 1))).toBe(false);
  });

  it('handles a cross-midnight-boundary case (23:59:59 vs 00:00:01 next day) as different days', () => {
    expect(isSameCalendarDay(localIso(2026, 0, 1, 23, 59, 59), localIso(2026, 0, 2, 0, 0, 1))).toBe(false);
  });

  it('handles a DST-crossing pair of local timestamps as the same day when the local calendar date matches', () => {
    // US DST spring-forward 2026-03-08: 1:59am -> 3:00am local. Both
    // timestamps land on the same local calendar date despite the clock
    // jump elsewhere in the day, so this must still resolve to true.
    expect(isSameCalendarDay(localIso(2026, 2, 8, 1, 30), localIso(2026, 2, 8, 20, 0))).toBe(true);
  });

  it('is identical to itself', () => {
    const iso = localIso(2026, 6, 26, 12);
    expect(isSameCalendarDay(iso, iso)).toBe(true);
  });
});
