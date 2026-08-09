import { describe, expect, it } from 'vitest';
import { timeAgo } from './time-ago';

function localDate(year: number, month: number, day: number, hour: number, minute = 0, second = 0): Date {
  return new Date(year, month, day, hour, minute, second);
}

describe('timeAgo', () => {
  const now = localDate(2026, 6, 26, 14, 30, 0);

  it('returns "Just now" for under a minute', () => {
    const iso = new Date(now.getTime() - 30 * 1000).toISOString();
    expect(timeAgo(iso, now)).toBe('Just now');
  });

  it('formats minutes ago, matching the wireframe\'s "2m ago" style', () => {
    const iso = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
    expect(timeAgo(iso, now)).toBe('2m ago');
  });

  it('formats 9 minutes ago, matching the wireframe\'s "9m ago" style', () => {
    const iso = new Date(now.getTime() - 9 * 60 * 1000).toISOString();
    expect(timeAgo(iso, now)).toBe('9m ago');
  });

  it('formats hours ago within the same calendar day', () => {
    const iso = localDate(2026, 6, 26, 13, 30, 0).toISOString();
    expect(timeAgo(iso, now)).toBe('1h ago');
  });

  it('returns "Yesterday" for the previous calendar day, even if under 24h ago', () => {
    // now is 2026-07-26 14:30; 11:58pm the prior night is <15h ago but a
    // different calendar day.
    const iso = localDate(2026, 6, 25, 23, 58, 0).toISOString();
    expect(timeAgo(iso, now)).toBe('Yesterday');
  });

  it('returns "Yesterday" for a timestamp comfortably in the prior calendar day', () => {
    const iso = localDate(2026, 6, 25, 9, 0, 0).toISOString();
    expect(timeAgo(iso, now)).toBe('Yesterday');
  });

  it('formats "N days ago" for 2-6 days back', () => {
    const iso = localDate(2026, 6, 23, 14, 0, 0).toISOString();
    expect(timeAgo(iso, now)).toBe('3 days ago');
  });

  it('falls back to a calendar date once 7+ days have passed', () => {
    const iso = localDate(2026, 6, 10, 14, 0, 0).toISOString();
    expect(timeAgo(iso, now)).toBe('Jul 10');
  });

  it('includes the year when the date is from a different calendar year', () => {
    const iso = localDate(2025, 11, 20, 14, 0, 0).toISOString();
    expect(timeAgo(iso, now)).toBe('Dec 20, 2025');
  });

  it('returns "Just now" for a timestamp slightly in the future (clock skew tolerance)', () => {
    const iso = new Date(now.getTime() + 10 * 1000).toISOString();
    expect(timeAgo(iso, now)).toBe('Just now');
  });

  it('returns an empty string for an invalid timestamp', () => {
    expect(timeAgo('not-a-date', now)).toBe('');
  });
});
