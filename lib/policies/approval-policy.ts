import type { UserRole } from '../../types';

// Batch 1 (ADR-036) scaffolding. This is a READ-ONLY LOCAL MIRROR of a
// server-side gate (ADR-006: lifecycle automations run server-side, never
// on-device — the same pattern as `lib/client-status.ts`'s
// `WAITING_MANAGER_APPROVAL_BADGE`). It predicts what the server will
// decide, purely for UI affordances (e.g. graying out an edit control); it
// is never itself the authority, and nothing here writes an approval
// decision anywhere.

// ADR-052 section C (Batch 6 Phase 5, 2026-08-01): the full editable-field
// allowlist for a client record. NOT the same set as
// `lib/client-progress.ts`'s `getInfoChecklist()` — that function groups
// `contact_person`+`contact_position` into a single display row for the
// Complete/Edit Info checklist UI, which is a display grouping, not this
// module's actual field set (the stale doc-comment previously here claimed
// otherwise; corrected per ADR-052 section J item 5).
export const CLIENT_EDITABLE_FIELDS = [
  'company_name',
  'contact_person',
  'contact_position',
  'contact_number',
  'office_address',
  'sales_channel',
  'customer_type',
  'minor_notes',
] as const;

// ADR-052 decision 2 / section C: the ONE field a Sales/RSR edit can save
// directly without triggering a Manager approval request.
export const CLIENT_APPROVAL_EXEMPT_FIELDS = ['minor_notes'] as const;

/**
 * Fields whose edits require manager approval, per entity. For 'clients',
 * derived (never hand-maintained in parallel) as
 * CLIENT_EDITABLE_FIELDS minus CLIENT_APPROVAL_EXEMPT_FIELDS — ADR-052
 * section C's explicit recommendation, so the two lists can never silently
 * drift apart. For 'meetings', no meeting-field approval concept exists
 * yet — returns an empty array rather than inventing one.
 */
export function getFieldsRequiringApproval(entity: 'clients' | 'meetings'): readonly string[] {
  if (entity === 'meetings') return [];
  const exempt: readonly string[] = CLIENT_APPROVAL_EXEMPT_FIELDS;
  return CLIENT_EDITABLE_FIELDS.filter((field) => !exempt.includes(field));
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
