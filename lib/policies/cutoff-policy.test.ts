import { describe, expect, it } from 'vitest';
import {
  classifyClientMeetings,
  findActiveCutoffPeriod,
  getClientCap,
  getRoleQuotaTarget,
  summarizeCutoffQuota,
  type CutoffClientCapConfig,
  type CutoffMeetingInput,
  type CutoffPeriod,
  type CutoffRoleQuotaTarget,
} from './cutoff-policy';

const PERIOD: CutoffPeriod = { id: 'p1', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-30T23:59:59.000Z' };

function meeting(overrides: Partial<CutoffMeetingInput> & Pick<CutoffMeetingInput, 'id'>): CutoffMeetingInput {
  return {
    clientId: 'c1',
    startCapturedAtIso: '2026-09-05T00:00:00.000Z',
    clientStatusAtStart: 'new',
    outcome: 'Successful',
    meetingMode: 'in_person',
    validityStatus: 'valid',
    hasRequiredEvidence: true,
    tagAlongDeclined: false,
    isDuplicate: false,
    ...overrides,
  };
}

describe('findActiveCutoffPeriod', () => {
  it('matches an arbitrary date range, not calendar boundaries', () => {
    expect(findActiveCutoffPeriod([PERIOD], '2026-09-15T00:00:00.000Z')).toEqual(PERIOD);
  });

  it('returns null (unattributed) when no period covers the timestamp', () => {
    expect(findActiveCutoffPeriod([PERIOD], '2026-10-01T00:00:00.000Z')).toBeNull();
  });
});

describe('getRoleQuotaTarget', () => {
  const targets: CutoffRoleQuotaTarget[] = [
    { periodId: 'p1', role: 'sales_specialist', target: 24 },
    { periodId: 'p1', role: 'rsr', target: 30 },
  ];

  it('never falls back to the other role', () => {
    expect(getRoleQuotaTarget('sales_specialist', 'p1', targets)).toBe(24);
    expect(getRoleQuotaTarget('rsr', 'p1', targets)).toBe(30);
  });

  it('returns null (unconfigured), never a hardcoded default', () => {
    expect(getRoleQuotaTarget('sales_specialist', 'unknown-period', targets)).toBeNull();
  });
});

describe('getClientCap', () => {
  it('prefers a role-specific override over the shared cap', () => {
    const caps: CutoffClientCapConfig[] = [
      { periodId: 'p1', role: null, cap: 2 },
      { periodId: 'p1', role: 'rsr', cap: 4 },
    ];
    expect(getClientCap('rsr', 'p1', caps)).toBe(4);
    expect(getClientCap('sales_specialist', 'p1', caps)).toBe(2);
  });

  it('returns null when nothing is configured', () => {
    expect(getClientCap('rsr', 'p1', [])).toBeNull();
  });
});

describe('classifyClientMeetings', () => {
  const caps: CutoffClientCapConfig[] = [{ periodId: 'p1', role: null, cap: 2 }];

  it('counts valid meetings up to the shared cap, marks the rest over_cap', () => {
    const meetings = [
      meeting({ id: 'm1', startCapturedAtIso: '2026-09-01T00:00:00.000Z' }),
      meeting({ id: 'm2', startCapturedAtIso: '2026-09-02T00:00:00.000Z' }),
      meeting({ id: 'm3', startCapturedAtIso: '2026-09-03T00:00:00.000Z' }),
    ];
    const result = classifyClientMeetings(meetings, [PERIOD], 'sales_specialist', caps);
    expect(result.get('m1')).toBe('counted');
    expect(result.get('m2')).toBe('counted');
    expect(result.get('m3')).toBe('over_cap');
  });

  it('excludes prospect/in_progress from the cap entirely (uncapped)', () => {
    const result = classifyClientMeetings(
      [meeting({ id: 'm1', clientStatusAtStart: 'prospect' })],
      [PERIOD],
      'sales_specialist',
      caps
    );
    expect(result.get('m1')).toBe('excluded_uncapped');
  });

  it('marks a pending manager tag-along as pending_validity, consuming no slot', () => {
    const meetings = [
      meeting({ id: 'm1', validityStatus: 'pending_confirmation' }),
      meeting({ id: 'm2', startCapturedAtIso: '2026-09-02T00:00:00.000Z' }),
      meeting({ id: 'm3', startCapturedAtIso: '2026-09-03T00:00:00.000Z' }),
    ];
    const result = classifyClientMeetings(meetings, [PERIOD], 'sales_specialist', caps);
    expect(result.get('m1')).toBe('pending_validity');
    // Two remaining meetings both fit the cap of 2 since the pending one never consumed a slot.
    expect(result.get('m2')).toBe('counted');
    expect(result.get('m3')).toBe('counted');
  });

  it('marks a declined tag-along as excluded_invalid, never over_cap', () => {
    const result = classifyClientMeetings([meeting({ id: 'm1', tagAlongDeclined: true })], [PERIOD], 'sales_specialist', caps);
    expect(result.get('m1')).toBe('excluded_invalid');
  });

  it('marks No Decision / missing evidence as excluded_invalid', () => {
    const result = classifyClientMeetings(
      [meeting({ id: 'm1', outcome: 'No Decision' }), meeting({ id: 'm2', outcome: 'Successful', hasRequiredEvidence: false })],
      [PERIOD],
      'sales_specialist',
      caps
    );
    expect(result.get('m1')).toBe('excluded_invalid');
    expect(result.get('m2')).toBe('excluded_invalid');
  });

  it('counts online meetings (supersedes legacy in-person-only quota rule)', () => {
    const result = classifyClientMeetings([meeting({ id: 'm1', meetingMode: 'online' })], [PERIOD], 'sales_specialist', caps);
    expect(result.get('m1')).toBe('counted');
  });

  it('marks a meeting with no start_captured_at as unattributed', () => {
    const result = classifyClientMeetings([meeting({ id: 'm1', startCapturedAtIso: null })], [PERIOD], 'sales_specialist', caps);
    expect(result.get('m1')).toBe('unattributed');
  });

  it('marks a meeting outside any active period as unattributed, never backdated', () => {
    const result = classifyClientMeetings(
      [meeting({ id: 'm1', startCapturedAtIso: '2026-11-01T00:00:00.000Z' })],
      [PERIOD],
      'sales_specialist',
      caps
    );
    expect(result.get('m1')).toBe('unattributed');
  });

  it('treats an unconfigured cap as uncapped rather than blocking counting', () => {
    const result = classifyClientMeetings([meeting({ id: 'm1' })], [PERIOD], 'sales_specialist', []);
    expect(result.get('m1')).toBe('counted');
  });
});

describe('summarizeCutoffQuota', () => {
  const targets: CutoffRoleQuotaTarget[] = [{ periodId: 'p1', role: 'sales_specialist', target: 24 }];
  const caps: CutoffClientCapConfig[] = [{ periodId: 'p1', role: null, cap: 2 }];

  it('returns null when no period is active (unconfigured/no-quota-card state)', () => {
    expect(summarizeCutoffQuota([], [], 'sales_specialist', targets, caps, '2026-09-05T00:00:00.000Z')).toBeNull();
  });

  it('returns explicit null target when role has no configured quota', () => {
    const result = summarizeCutoffQuota([], [PERIOD], 'rsr', targets, caps, '2026-09-05T00:00:00.000Z');
    expect(result?.target).toBeNull();
  });

  it('aggregates confirmed/pending counts per-client across multiple clients', () => {
    const meetings = [
      meeting({ id: 'm1', clientId: 'c1' }),
      meeting({ id: 'm2', clientId: 'c1', startCapturedAtIso: '2026-09-02T00:00:00.000Z' }),
      meeting({ id: 'm3', clientId: 'c1', startCapturedAtIso: '2026-09-03T00:00:00.000Z' }), // over_cap for c1
      meeting({ id: 'm4', clientId: 'c2' }),
      meeting({ id: 'm5', clientId: 'c2', validityStatus: 'pending_confirmation' }),
    ];
    const result = summarizeCutoffQuota(meetings, [PERIOD], 'sales_specialist', targets, caps, '2026-09-05T00:00:00.000Z');
    expect(result?.confirmedCount).toBe(3); // m1, m2, m4
    expect(result?.pendingCount).toBe(1); // m5
    expect(result?.target).toBe(24);
  });
});
