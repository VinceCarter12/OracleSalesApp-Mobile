import { describe, expect, it } from 'vitest';
import { isDateWithinInclusiveRange, manilaCalendarDate } from './manila-calendar';

describe('manilaCalendarDate', () => {
  it('keeps a post-midnight PHT timestamp on the Manila day', () => {
    expect(manilaCalendarDate('2026-08-08T16:28:00.000Z')).toBe('2026-08-09');
  });

  it('keeps a pre-midnight PHT timestamp on the prior Manila day', () => {
    expect(manilaCalendarDate('2026-08-08T15:59:59.000Z')).toBe('2026-08-08');
  });

  it('compares server YYYY-MM-DD boundaries without Date/UTC coercion', () => {
    expect(isDateWithinInclusiveRange('2026-08-09', '2026-08-09', '2026-08-23')).toBe(true);
    expect(isDateWithinInclusiveRange('2026-08-08', '2026-08-09', '2026-08-23')).toBe(false);
    expect(isDateWithinInclusiveRange('2026-08-24', '2026-08-09', '2026-08-23')).toBe(false);
  });
});
