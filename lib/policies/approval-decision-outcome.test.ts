import { describe, expect, it } from 'vitest';
import { classifyDecisionCode, describeDecisionFailure } from './approval-decision-outcome';

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

describe('describeDecisionFailure', () => {
  it('gives each refusal its own phrase, so a bulk run can list several at once', () => {
    expect(describeDecisionFailure('already_decided')).toBe('already decided by someone else');
    expect(describeDecisionFailure('base_conflict')).toBe('the client record changed since it was filed');
    expect(describeDecisionFailure('role_not_eligible')).toBe('not yours to review');
    expect(describeDecisionFailure('not_found')).toBe('no longer exists');
  });

  it('returns empty for the two success codes, which are never failures', () => {
    expect(describeDecisionFailure('approved')).toBe('');
    expect(describeDecisionFailure('rejected')).toBe('');
  });

  it('falls back to a generic phrase for anything unrecognized, including transport_error', () => {
    expect(describeDecisionFailure('transport_error')).toBe("couldn't be processed");
    expect(describeDecisionFailure('invalid_decision')).toBe("couldn't be processed");
    expect(describeDecisionFailure('')).toBe("couldn't be processed");
  });
});
