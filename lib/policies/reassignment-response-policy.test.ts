import { describe, expect, it } from 'vitest';
import {
  isReassignSuccess,
  mapReassignResponseCode,
  type ReassignResponseCode,
} from './reassignment-response-policy';

const ALL_CODES: ReassignResponseCode[] = [
  'reason_required',
  'same_owner',
  'role_not_eligible',
  'new_owner_not_in_team',
  'new_owner_not_eligible',
  'stale_or_not_permitted',
  'reassigned',
];

describe('mapReassignResponseCode', () => {
  it.each(ALL_CODES)('returns a non-empty message for every live Migration 044 code (%s)', (code) => {
    expect(mapReassignResponseCode(code).length).toBeGreaterThan(0);
  });

  it('maps stale_or_not_permitted to the conflict/refresh message', () => {
    expect(mapReassignResponseCode('stale_or_not_permitted')).toMatch(/i-refresh/i);
  });

  it('maps reason_required to a distinct message from same_owner', () => {
    expect(mapReassignResponseCode('reason_required')).not.toBe(mapReassignResponseCode('same_owner'));
  });
});

describe('isReassignSuccess', () => {
  it('is true only for reassigned', () => {
    expect(isReassignSuccess('reassigned')).toBe(true);
  });

  it.each(ALL_CODES.filter((c) => c !== 'reassigned'))('is false for rejection code %s', (code) => {
    expect(isReassignSuccess(code)).toBe(false);
  });
});
