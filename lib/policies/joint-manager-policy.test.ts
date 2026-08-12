import { describe, expect, it } from 'vitest';
import { formatJointApprovalStatus, holderBadge } from './joint-manager-policy';

describe('joint manager approval status', () => {
  it('requires the only holder approval', () => {
    expect(formatJointApprovalStatus(1, 0, false)).toBe('Pending approval');
    expect(formatJointApprovalStatus(1, 1, false)).toBe('Approved');
  });
  it('waits for both managers and declines on any decline', () => {
    expect(formatJointApprovalStatus(2, 0, false)).toBe('Joint approval · 0/2 approved');
    expect(formatJointApprovalStatus(2, 1, false)).toBe('Joint approval · 1/2 approved');
    expect(formatJointApprovalStatus(2, 1, true)).toBe('Joint approval · Declined');
    expect(formatJointApprovalStatus(2, 2, false)).toBe('Joint approval · Approved');
  });
  it('keeps origin and active holder labels separate', () => {
    expect(holderBadge(['Manager South'], 'Team North')).toEqual({ holder: 'Manager South', origin: 'Origin: Team North' });
  });
});
