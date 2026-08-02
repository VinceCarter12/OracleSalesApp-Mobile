import { describe, expect, it } from 'vitest';
import { classifyDecisionCode } from './approval-decision-outcome';

describe('classifyDecisionCode', () => {
  it('classifies approved/rejected as success', () => {
    expect(classifyDecisionCode('approved')).toBe('success');
    expect(classifyDecisionCode('rejected')).toBe('success');
  });

  it('classifies already_decided as its own bucket, not an error', () => {
    expect(classifyDecisionCode('already_decided')).toBe('already_decided');
  });

  it('classifies base_conflict (client-edit-only outcome) as conflict', () => {
    expect(classifyDecisionCode('base_conflict')).toBe('conflict');
  });

  it('classifies role_not_eligible/not_found/invalid_decision as error', () => {
    expect(classifyDecisionCode('role_not_eligible')).toBe('error');
    expect(classifyDecisionCode('not_found')).toBe('error');
    expect(classifyDecisionCode('invalid_decision')).toBe('error');
  });

  it('falls back to error for any unrecognized code', () => {
    expect(classifyDecisionCode('cancelled')).toBe('error');
    expect(classifyDecisionCode('')).toBe('error');
  });
});
