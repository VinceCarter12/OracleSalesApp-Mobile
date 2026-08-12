import { describe, expect, it } from 'vitest';
import { determineCompleteInfoSubmitBranch, type DetermineCompleteInfoSubmitBranchInput } from './complete-info-branch';

function baseInput(overrides: Partial<DetermineCompleteInfoSubmitBranchInput> = {}): DetermineCompleteInfoSubmitBranchInput {
  return {
    hasPendingRequest: false,
    isManagerOwnClient: false,
    approvalRequiredFields: [],
    directApplyFields: [],
    ...overrides,
  };
}

describe('determineCompleteInfoSubmitBranch', () => {
  it('step 1: blocks on an existing pending request regardless of every other input', () => {
    expect(
      determineCompleteInfoSubmitBranch(
        baseInput({ hasPendingRequest: true, isManagerOwnClient: true, directApplyFields: ['contact_person'] })
      )
    ).toBe('blocked_pending');
  });

  it('first save on a blank client: every field was blank-before, so all land in directApplyFields — direct', () => {
    expect(
      determineCompleteInfoSubmitBranch(
        baseInput({ directApplyFields: ['contact_person', 'contact_number', 'sales_channel'] })
      )
    ).toBe('direct_first_time');
  });

  it('filling the one remaining blank field on an otherwise-complete client is still direct (the bug this fixes)', () => {
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ directApplyFields: ['office_address'] }))
    ).toBe('direct_first_time');
  });

  it('a changeset limited to only minor_notes is direct for any role, manager or not', () => {
    expect(determineCompleteInfoSubmitBranch(baseInput({ directApplyFields: ['minor_notes'] }))).toBe('direct_first_time');
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ directApplyFields: ['minor_notes'], isManagerOwnClient: true }))
    ).toBe('direct_first_time');
  });

  it('an empty changeset (nothing dirty at all) is a true no-op direct save', () => {
    expect(determineCompleteInfoSubmitBranch(baseInput())).toBe('direct_exempt_only');
  });

  it('manager editing their own client direct-writes even when an already-set field is bundled with a blank-before field', () => {
    expect(
      determineCompleteInfoSubmitBranch(
        baseInput({ isManagerOwnClient: true, approvalRequiredFields: ['contact_person'], directApplyFields: ['office_address'] })
      )
    ).toBe('direct_manager_owns');
  });

  it('manager editing their own client direct-writes for a customer_type (status) change with nothing else dirty', () => {
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ isManagerOwnClient: true, approvalRequiredFields: ['customer_type'] }))
    ).toBe('direct_manager_owns');
  });

  it('re-editing an already-set field (sales_specialist/rsr, not manager-owns) falls to request_approval', () => {
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ approvalRequiredFields: ['contact_number'] }))
    ).toBe('request_approval');
  });

  it('customer_type (status) change requires approval just like any other already-set field', () => {
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ approvalRequiredFields: ['customer_type'] }))
    ).toBe('request_approval');
  });

  it('still request_approval even when a directApplyFields field (minor_notes / a blank-before field) is bundled alongside an approval-required field', () => {
    expect(
      determineCompleteInfoSubmitBranch(
        baseInput({ approvalRequiredFields: ['office_address'], directApplyFields: ['minor_notes'] })
      )
    ).toBe('request_approval');
  });

  it('the pending-request guard takes priority over everything, including an all-blank-before first save', () => {
    expect(
      determineCompleteInfoSubmitBranch(
        baseInput({ hasPendingRequest: true, directApplyFields: ['contact_person', 'contact_number'] })
      )
    ).toBe('blocked_pending');
  });
});
