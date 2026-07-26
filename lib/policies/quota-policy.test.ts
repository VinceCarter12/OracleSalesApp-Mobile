import { describe, expect, it } from 'vitest';
import { countValidMeetingsForQuota, getQuotaTarget, type QuotaPolicyConfig } from './quota-policy';
import type { Meeting } from '../../types';

describe('getQuotaTarget', () => {
  const config: QuotaPolicyConfig = {
    policyId: 'rsr_daily_visits',
    role: 'rsr',
    dailyTarget: 12,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
  };

  it('returns null when config is null', () => {
    expect(getQuotaTarget('rsr', null)).toBeNull();
  });

  it("returns config.dailyTarget when the role matches the config's role", () => {
    expect(getQuotaTarget('rsr', config)).toBe(12);
  });

  it("returns null when the role does not match the config's role", () => {
    expect(getQuotaTarget('sales_specialist', config)).toBeNull();
  });
});

describe('countValidMeetingsForQuota', () => {
  it('counts only same-day, in-person meetings across a mixed array', () => {
    const day = '2026-07-26T12:00:00.000Z';
    const meetings: Pick<Meeting, 'meeting_mode' | 'logged_at'>[] = [
      { meeting_mode: 'in_person', logged_at: '2026-07-26T01:00:00.000Z' },
      { meeting_mode: 'online', logged_at: '2026-07-26T02:00:00.000Z' },
      { meeting_mode: 'in_person', logged_at: '2026-07-25T01:00:00.000Z' },
      { meeting_mode: undefined, logged_at: '2026-07-26T03:00:00.000Z' },
    ];
    expect(countValidMeetingsForQuota(meetings, day)).toBe(2);
  });
});
