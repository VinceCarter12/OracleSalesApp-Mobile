import { describe, expect, it } from 'vitest';
import {
  classifyDecisionCode,
  describeConflictReason,
  describeDecisionFailure,
  GENERIC_CONFLICT_MESSAGE,
} from './approval-decision-outcome';

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

describe('describeConflictReason', () => {
  it('names the agent a reassignment moved the client to', () => {
    expect(describeConflictReason({ reason: 'reassigned', current_agent_name: 'Maria Santos' }))
      .toContain('Maria Santos');
  });

  it('still reads correctly when the reassignment has no name to show', () => {
    const message = describeConflictReason({ reason: 'reassigned', current_agent_name: null });
    expect(message).toContain('reassigned');
    expect(message).not.toContain('null');
  });

  it('explains a lost client without suggesting a re-review', () => {
    expect(describeConflictReason({ reason: 'lost' })).toContain('marked as lost');
  });

  /**
   * The 2026-09-01 report: a close-deal PO approved a minute after
   * the edit request was filed promoted the client to New, which migration 128
   * refuses to overwrite. Telling the manager to "review again" was the wrong
   * advice that this whole path exists to replace.
   */
  it('dates the PO that superseded the request, and points at Reject not re-review', () => {
    const message = describeConflictReason({
      reason: 'stage_already_new',
      po_decided_at: '2026-09-01T09:17:00Z',
    });
    expect(message).toContain('Sep 1');
    expect(message).toContain('Reject');
    expect(message).not.toMatch(/review again/i);
  });

  it('drops the date when the promotion came from the tag-along path, which has no PO', () => {
    const message = describeConflictReason({ reason: 'stage_already_new', po_decided_at: null });
    expect(message).toContain('now New');
    expect(message).not.toContain('null');
    expect(message).not.toMatch(/Invalid Date/);
  });

  it('names the field that moved, in prose rather than as a column name', () => {
    const message = describeConflictReason({
      reason: 'field_changed',
      field: 'contact_number',
      current_value: '0917 555 0101',
    });
    expect(message).toContain('The contact number');
    expect(message).toContain('0917 555 0101');
    expect(message).not.toContain('contact_number');
  });

  it('says blank rather than null for a field that was cleared', () => {
    const message = describeConflictReason({ reason: 'field_changed', field: 'office_address', current_value: null });
    expect(message).toContain('blank');
    expect(message).not.toContain('null');
  });

  it('tells the manager to retry when the conflict cleared underneath them', () => {
    expect(describeConflictReason({ reason: 'none' })).toMatch(/try approving again/i);
  });

  it('falls back to the generic wording for a null detail or an unknown reason', () => {
    // null is what fetchClientEditConflictDetail() returns on ANY failure —
    // losing the better sentence must never lose the message entirely.
    expect(describeConflictReason(null)).toBe(GENERIC_CONFLICT_MESSAGE);
    expect(describeConflictReason({ reason: 'something_added_later' })).toBe(GENERIC_CONFLICT_MESSAGE);
  });
});
