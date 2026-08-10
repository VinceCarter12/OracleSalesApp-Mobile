import { describe, expect, it } from 'vitest';
import {
  countNewClientsAcquired,
  filterMeetingsByTimeframe,
  resolveTimeframe,
} from './report-timeframe';

const NOW = new Date('2026-08-10T12:00:00.000Z');

describe('resolveTimeframe', () => {
  it('gives fixed chips a computed start and open end', () => {
    const { start, end } = resolveTimeframe('This month', NOW);
    expect(start).not.toBeNull();
    expect(end).toBeNull();
  });

  it('snaps a custom range to whole-day bounds (inclusive of the end day)', () => {
    const { start, end } = resolveTimeframe('Custom', NOW, {
      start: new Date(2026, 7, 1, 15, 0),
      end: new Date(2026, 7, 10, 9, 0),
    });
    expect(start?.getHours()).toBe(0);
    expect(end?.getHours()).toBe(23);
    expect(end?.getMinutes()).toBe(59);
  });

  it('treats a custom range with no bounds as all-time', () => {
    expect(resolveTimeframe('Custom', NOW, { start: null, end: null })).toEqual({ start: null, end: null });
    expect(resolveTimeframe('Custom', NOW)).toEqual({ start: null, end: null });
  });
});

describe('filterMeetingsByTimeframe with a custom range', () => {
  const meetings = [
    { meetingDateIso: '2026-07-15T10:00:00.000Z' },
    { meetingDateIso: '2026-08-05T10:00:00.000Z' },
    { meetingDateIso: '2026-08-20T10:00:00.000Z' },
  ];

  it('keeps only meetings inside the inclusive [start, end] window', () => {
    const result = filterMeetingsByTimeframe(meetings, 'Custom', NOW, {
      start: new Date(2026, 7, 1),
      end: new Date(2026, 7, 10),
    });
    expect(result).toEqual([{ meetingDateIso: '2026-08-05T10:00:00.000Z' }]);
  });

  it('is open-ended when only one bound is set', () => {
    const fromOnly = filterMeetingsByTimeframe(meetings, 'Custom', NOW, {
      start: new Date(2026, 7, 1),
      end: null,
    });
    expect(fromOnly).toHaveLength(2);
  });

  it('returns everything when the custom range is empty (all-time)', () => {
    expect(filterMeetingsByTimeframe(meetings, 'Custom', NOW, { start: null, end: null })).toHaveLength(3);
  });
});

describe('countNewClientsAcquired with a custom range', () => {
  const clients = [
    { status: 'new' as const, createdAt: '2026-08-05T10:00:00.000Z' },
    { status: 'existing' as const, createdAt: '2026-07-01T10:00:00.000Z' },
    { status: 'prospect' as const, createdAt: '2026-08-06T10:00:00.000Z' },
  ];

  it('counts only new/existing clients created within the range', () => {
    const count = countNewClientsAcquired(clients, 'Custom', NOW, {
      start: new Date(2026, 7, 1),
      end: new Date(2026, 7, 10),
    });
    expect(count).toBe(1);
  });
});
