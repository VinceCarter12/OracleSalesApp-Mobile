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
  const day = '2026-07-26T12:00:00.000Z';

  it('counts only same-day, in-person meetings across a mixed array', () => {
    const meetings: Pick<Meeting, 'meeting_mode' | 'logged_at' | 'validity_status'>[] = [
      { meeting_mode: 'in_person', logged_at: '2026-07-26T01:00:00.000Z', validity_status: 'valid' },
      { meeting_mode: 'online', logged_at: '2026-07-26T02:00:00.000Z', validity_status: 'valid' },
      { meeting_mode: 'in_person', logged_at: '2026-07-25T01:00:00.000Z', validity_status: 'valid' },
      { meeting_mode: undefined, logged_at: '2026-07-26T03:00:00.000Z', validity_status: 'valid' },
    ];
    expect(countValidMeetingsForQuota(meetings, day)).toBe(2);
  });

  // ADR-046 correction addendum: only a pending MANAGER tag-along excludes a
  // meeting from quota — this is that exclusion at the quota-policy layer
  // (lib/policies/tag-along-validity-policy.test.ts covers the earlier
  // creation-time decision of which kind sets 'pending_confirmation').
  it('excludes a same-day in-person meeting still gated by a pending MANAGER tag-along', () => {
    const meetings: Pick<Meeting, 'meeting_mode' | 'logged_at' | 'validity_status'>[] = [
      { meeting_mode: 'in_person', logged_at: '2026-07-26T01:00:00.000Z', validity_status: 'pending_confirmation' },
    ];
    expect(countValidMeetingsForQuota(meetings, day)).toBe(0);
  });

  it('does NOT exclude a meeting whose only companion was a teammate (never sets pending_confirmation)', () => {
    const meetings: Pick<Meeting, 'meeting_mode' | 'logged_at' | 'validity_status'>[] = [
      { meeting_mode: 'in_person', logged_at: '2026-07-26T01:00:00.000Z', validity_status: 'valid' },
    ];
    expect(countValidMeetingsForQuota(meetings, day)).toBe(1);
  });

  it('treats a missing validity_status (pre-migration row) as valid, matching the column default', () => {
    const meetings: Pick<Meeting, 'meeting_mode' | 'logged_at' | 'validity_status'>[] = [
      { meeting_mode: 'in_person', logged_at: '2026-07-26T01:00:00.000Z', validity_status: undefined },
    ];
    expect(countValidMeetingsForQuota(meetings, day)).toBe(1);
  });
});
