import { describe, expect, it } from 'vitest';
import { determineCompleteInfoSubmitBranch, type DetermineCompleteInfoSubmitBranchInput } from './complete-info-branch';

const EXEMPT = ['minor_notes'] as const;

function baseInput(overrides: Partial<DetermineCompleteInfoSubmitBranchInput> = {}): DetermineCompleteInfoSubmitBranchInput {
  return {
    hasPendingRequest: false,
    firstTime: false,
    isManagerOwnClient: false,
    changedFields: [],
    exemptFields: EXEMPT,
    ...overrides,
  };
}

describe('determineCompleteInfoSubmitBranch', () => {
  it('step 1: blocks on an existing pending request regardless of every other input', () => {
    expect(
      determineCompleteInfoSubmitBranch(
        baseInput({ hasPendingRequest: true, firstTime: true, isManagerOwnClient: true, changedFields: ['company_name'] })
      )
    ).toBe('blocked_pending');
  });

  it('step 2: first-time completion is always direct, even with approval-required fields dirty', () => {
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ firstTime: true, changedFields: ['company_name', 'sales_channel'] }))
    ).toBe('direct_first_time');
  });

  it('step 3: a changeset limited to only minor_notes is direct for any role, manager or not', () => {
    expect(determineCompleteInfoSubmitBranch(baseInput({ changedFields: ['minor_notes'] }))).toBe('direct_exempt_only');
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ changedFields: ['minor_notes'], isManagerOwnClient: true }))
    ).toBe('direct_exempt_only');
  });

  it('step 3: an empty changeset (nothing dirty) is also treated as exempt-only (no-op direct save)', () => {
    expect(determineCompleteInfoSubmitBranch(baseInput({ changedFields: [] }))).toBe('direct_exempt_only');
  });

  it('step 4: manager editing their own client direct-writes even when minor_notes is bundled with other changes', () => {
    expect(
      determineCompleteInfoSubmitBranch(
        baseInput({ isManagerOwnClient: true, changedFields: ['minor_notes', 'company_name'] })
      )
    ).toBe('direct_manager_owns');
  });

  it('step 4: manager editing their own client direct-writes for a non-exempt-only change with no minor_notes involved', () => {
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ isManagerOwnClient: true, changedFields: ['customer_type'] }))
    ).toBe('direct_manager_owns');
  });

  it('step 5: sales_specialist/rsr (not manager-owns) with an approval-required field falls to request_approval', () => {
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ changedFields: ['contact_number'] }))
    ).toBe('request_approval');
  });

  it('step 5: still request_approval even when minor_notes is bundled alongside an approval-required field', () => {
    expect(
      determineCompleteInfoSubmitBranch(baseInput({ changedFields: ['minor_notes', 'office_address'] }))
    ).toBe('request_approval');
  });
});
