import { describe, expect, it } from 'vitest';
import { canApproveEdit, type ApprovalContext } from './approval-policy';

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
