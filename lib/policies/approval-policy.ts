import type { UserRole } from '../../types';

// Batch 1 (ADR-036) scaffolding. This is a READ-ONLY LOCAL MIRROR of a
// server-side gate (ADR-006: lifecycle automations run server-side, never
// on-device — the same pattern as `lib/client-status.ts`'s
// `WAITING_MANAGER_APPROVAL_BADGE`). It predicts what the server will
// decide, purely for UI affordances (e.g. graying out an edit control); it
// is never itself the authority, and nothing here writes an approval
// decision anywhere.

/**
 * Fields whose edits require manager approval, per entity. For 'clients'
 * this mirrors `lib/client-progress.ts`'s `getInfoChecklist()` field set
 * exactly. For 'meetings', no meeting-field approval concept exists yet —
 * returns an empty array rather than inventing one.
 */
export function getFieldsRequiringApproval(entity: 'clients' | 'meetings'): readonly string[] {
  if (entity === 'meetings') return [];
  return ['company_name', 'contact_person', 'contact_number', 'office_address', 'sales_channel'];
}

export interface ApprovalContext {
  approverRole: UserRole;
  approverTeamId: string | null;
  requesterTeamId: string | null;
}

/** True only when a same-team, non-null-team sales_manager is approving; false in every other case, including both-null team_id. */
export function canApproveEdit(ctx: ApprovalContext): boolean {
  return (
    ctx.approverRole === 'sales_manager' &&
    ctx.approverTeamId !== null &&
    ctx.approverTeamId === ctx.requesterTeamId
  );
}
