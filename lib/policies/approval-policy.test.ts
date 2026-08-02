import { describe, expect, it } from 'vitest';
import {
  canApproveEdit,
  getFieldsRequiringApproval,
  CLIENT_EDITABLE_FIELDS,
  CLIENT_APPROVAL_EXEMPT_FIELDS,
  type ApprovalContext,
} from './approval-policy';

// ADR-052 section C (Batch 6 Phase 5): 8 editable fields, 1 approval-exempt
// (minor_notes), derived (never hand-maintained) 7-field approval-required set.
describe('getFieldsRequiringApproval', () => {
  it('returns all 8 CLIENT_EDITABLE_FIELDS minus minor_notes for clients (7 fields)', () => {
    const result = getFieldsRequiringApproval('clients');
    expect(result).toHaveLength(7);
    expect(result).toEqual([
      'company_name',
      'contact_person',
      'contact_position',
      'contact_number',
      'office_address',
      'sales_channel',
      'customer_type',
    ]);
  });

  it('never includes any CLIENT_APPROVAL_EXEMPT_FIELDS entry', () => {
    const result = getFieldsRequiringApproval('clients');
    for (const exempt of CLIENT_APPROVAL_EXEMPT_FIELDS) {
      expect(result).not.toContain(exempt);
    }
  });

  it('is always a strict subset of CLIENT_EDITABLE_FIELDS (derived, not hand-maintained)', () => {
    const result = getFieldsRequiringApproval('clients');
    const editable: readonly string[] = CLIENT_EDITABLE_FIELDS;
    for (const field of result) {
      expect(editable).toContain(field);
    }
  });

  it('returns an empty array for meetings (no meeting-field approval concept exists)', () => {
    expect(getFieldsRequiringApproval('meetings')).toEqual([]);
  });
});

describe('canApproveEdit', () => {
  it('is true for a matching non-null team_id sales_manager', () => {
    const ctx: ApprovalContext = {
      approverRole: 'sales_manager',
      approverTeamId: 'team-1',
      requesterTeamId: 'team-1',
    };
    expect(canApproveEdit(ctx)).toBe(true);
  });

  it('is false when the approver is not a sales_manager', () => {
    const ctx: ApprovalContext = {
      approverRole: 'sales_specialist',
      approverTeamId: 'team-1',
      requesterTeamId: 'team-1',
    };
    expect(canApproveEdit(ctx)).toBe(false);
  });

  it('is false when team ids differ', () => {
    const ctx: ApprovalContext = {
      approverRole: 'sales_manager',
      approverTeamId: 'team-1',
      requesterTeamId: 'team-2',
    };
    expect(canApproveEdit(ctx)).toBe(false);
  });

  it('is false when both team ids are null', () => {
    const ctx: ApprovalContext = {
      approverRole: 'sales_manager',
      approverTeamId: null,
      requesterTeamId: null,
    };
    expect(canApproveEdit(ctx)).toBe(false);
  });

  it('is false when only the approver team_id is null', () => {
    const ctx: ApprovalContext = {
      approverRole: 'sales_manager',
      approverTeamId: null,
      requesterTeamId: 'team-1',
    };
    expect(canApproveEdit(ctx)).toBe(false);
  });
});
