import { describe, expect, it } from 'vitest';
import {
  SESSION_ABANDONED_AFTER_HOURS,
  SESSION_OVERDUE_AFTER_HOURS,
  getSessionStatus,
  isValidMeetingForQuota,
} from './meeting-session-policy';
import type { Meeting } from '../../types';

const START_ISO = '2026-07-26T00:00:00.000Z';

function hoursLater(hours: number): string {
  return new Date(new Date(START_ISO).getTime() + hours * 60 * 60 * 1000).toISOString();
}

describe('getSessionStatus', () => {
  it('is active well before the overdue boundary', () => {
    expect(getSessionStatus(START_ISO, hoursLater(1))).toBe('active');
  });

  it('is active just before the overdue boundary', () => {
    expect(getSessionStatus(START_ISO, hoursLater(SESSION_OVERDUE_AFTER_HOURS - 0.01))).toBe('active');
  });

  it('is overdue exactly at the overdue boundary', () => {
    expect(getSessionStatus(START_ISO, hoursLater(SESSION_OVERDUE_AFTER_HOURS))).toBe('overdue');
  });

  it('is overdue just before the abandoned boundary', () => {
    expect(getSessionStatus(START_ISO, hoursLater(SESSION_ABANDONED_AFTER_HOURS - 0.01))).toBe('overdue');
  });

  it('is abandoned exactly at the abandoned boundary', () => {
    expect(getSessionStatus(START_ISO, hoursLater(SESSION_ABANDONED_AFTER_HOURS))).toBe('abandoned');
  });

  it('is abandoned well past the abandoned boundary', () => {
    expect(getSessionStatus(START_ISO, hoursLater(24))).toBe('abandoned');
  });

  it('clamps to active when startCapturedAtIso is in the future relative to now (clock skew)', () => {
    expect(getSessionStatus(hoursLater(1), START_ISO)).toBe('active');
  });
});

describe('isValidMeetingForQuota', () => {
  const day = '2026-07-26T12:00:00.000Z';

  it('excludes online meetings', () => {
    const meeting: Pick<Meeting, 'meeting_mode' | 'logged_at'> = {
      meeting_mode: 'online',
      logged_at: '2026-07-26T01:00:00.000Z',
    };
    expect(isValidMeetingForQuota(meeting, day)).toBe(false);
  });

  it('includes an in-person meeting logged the same day', () => {
    const meeting: Pick<Meeting, 'meeting_mode' | 'logged_at'> = {
      meeting_mode: 'in_person',
      logged_at: '2026-07-26T01:00:00.000Z',
    };
    expect(isValidMeetingForQuota(meeting, day)).toBe(true);
  });

  it('excludes an in-person meeting logged on a different day', () => {
    const meeting: Pick<Meeting, 'meeting_mode' | 'logged_at'> = {
      meeting_mode: 'in_person',
      logged_at: '2026-07-25T01:00:00.000Z',
    };
    expect(isValidMeetingForQuota(meeting, day)).toBe(false);
  });

  it('treats an undefined meeting_mode as in-person (legacy rows)', () => {
    const meeting: Pick<Meeting, 'meeting_mode' | 'logged_at'> = {
      meeting_mode: undefined,
      logged_at: '2026-07-26T01:00:00.000Z',
    };
    expect(isValidMeetingForQuota(meeting, day)).toBe(true);
  });
});
