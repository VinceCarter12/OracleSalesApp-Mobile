import { describe, expect, it } from 'vitest';
import {
  canClaimLostOpportunity,
  isClaimSuccess,
  mapLostOpportunityClaimCode,
  type LostOpportunityClaimCode,
} from './lost-opportunity-claim-policy';

const ALL_CODES: LostOpportunityClaimCode[] = [
  'claimed',
  'role_not_eligible',
  'former_owner_excluded',
  'cooling_down',
  'not_found_or_not_lost',
  'already_claimed',
];

describe('mapLostOpportunityClaimCode', () => {
  it.each(ALL_CODES)('returns a non-empty message for every live Migration 037 code (%s)', (code) => {
    expect(mapLostOpportunityClaimCode(code).length).toBeGreaterThan(0);
  });

  it('distinguishes former_owner_excluded (permanent) from cooling_down (temporary)', () => {
    const former = mapLostOpportunityClaimCode('former_owner_excluded');
    const cooling = mapLostOpportunityClaimCode('cooling_down');
    expect(former).not.toBe(cooling);
    expect(cooling).toMatch(/cooldown/i);
  });
});

describe('isClaimSuccess', () => {
  it('is true only for claimed', () => {
    expect(isClaimSuccess('claimed')).toBe(true);
  });

  it.each(ALL_CODES.filter((c) => c !== 'claimed'))('is false for rejection code %s', (code) => {
    expect(isClaimSuccess(code)).toBe(false);
  });
});

describe('canClaimLostOpportunity (ADR-039: manager view-only)', () => {
  it.each(['sales_specialist', 'rsr'] as const)('allows %s', (role) => {
    expect(canClaimLostOpportunity(role)).toBe(true);
  });

  it.each(['sales_manager', 'admin', 'superadmin', 'collector', null, undefined])(
    'disallows %s',
    (role) => {
      expect(canClaimLostOpportunity(role)).toBe(false);
    }
  );
});
