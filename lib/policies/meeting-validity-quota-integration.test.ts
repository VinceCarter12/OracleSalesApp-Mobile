import { describe, expect, it } from 'vitest';
import { computeMeetingValidityStatusOnCreate } from './tag-along-validity-policy';
import { countValidMeetingsForQuota } from './quota-policy';
import type { Meeting } from '../../types';

// Slice 8 (ADR-046, correction addendum): a genuinely cross-cutting test —
// existing unit tests already cover computeMeetingValidityStatusOnCreate()
// in isolation (tag-along-validity-policy.test.ts) and
// countValidMeetingsForQuota()'s validity_status filter in isolation
// (quota-policy.test.ts), but nothing chains the two the way
// lib/meeting-service.ts::createMeeting() actually does: the value this
// function computes AT CREATION is exactly what later gets persisted onto
// the `meetings.validity_status` column and read back by the quota query.
// This closes that composition gap for the three Prospect/New/Existing
// scenarios ADR-046 names explicitly — most importantly scenario 3, the
// single most important corrected behavior in this batch (a TEAMMATE-only
// tag-along must never block quota eligibility, unlike a MANAGER one).

function meetingOnDay(validityStatus: Meeting['validity_status']): Pick<
  Meeting,
  'meeting_mode' | 'logged_at' | 'validity_status'
> {
  return { meeting_mode: 'in_person', logged_at: '2026-07-28T09:00:00.000Z', validity_status: validityStatus };
}

const SAME_DAY = '2026-07-28T12:00:00.000Z';

describe('meeting validity → quota integration (ADR-046 correction addendum)', () => {
  it('scenario 1: no tag-along at all → valid at creation and counted in quota', () => {
    const validityStatus = computeMeetingValidityStatusOnCreate([], false);
    expect(validityStatus).toBe('valid');
    expect(countValidMeetingsForQuota([meetingOnDay(validityStatus)], SAME_DAY)).toBe(1);
  });

  it('scenario 2: a pending MANAGER tag-along → pending_confirmation at creation and excluded from quota', () => {
    const validityStatus = computeMeetingValidityStatusOnCreate([{ kind: 'manager' }], false);
    expect(validityStatus).toBe('pending_confirmation');
    expect(countValidMeetingsForQuota([meetingOnDay(validityStatus)], SAME_DAY)).toBe(0);
  });

  it('scenario 3 (corrected behavior): a TEAMMATE-only tag-along → valid immediately and counted in quota', () => {
    const validityStatus = computeMeetingValidityStatusOnCreate([{ kind: 'teammate' }], false);
    expect(validityStatus).toBe('valid');
    expect(countValidMeetingsForQuota([meetingOnDay(validityStatus)], SAME_DAY)).toBe(1);
  });

  it('a mixed manager+teammate selection still gates on the manager companion (pending, excluded)', () => {
    const validityStatus = computeMeetingValidityStatusOnCreate(
      [{ kind: 'teammate' }, { kind: 'manager' }],
      false
    );
    expect(validityStatus).toBe('pending_confirmation');
    expect(countValidMeetingsForQuota([meetingOnDay(validityStatus)], SAME_DAY)).toBe(0);
  });

  it('a Manager recording their own meeting with a pre-accepted manager companion is valid and counted', () => {
    const validityStatus = computeMeetingValidityStatusOnCreate([{ kind: 'manager' }], true);
    expect(validityStatus).toBe('valid');
    expect(countValidMeetingsForQuota([meetingOnDay(validityStatus)], SAME_DAY)).toBe(1);
  });
});
