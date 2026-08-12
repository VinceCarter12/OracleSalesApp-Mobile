// ADR-043 (Migration 038 Part C) + Migration 044 (P0 security hotfix,
// 2026-07-28): pure response-code -> user-message mapping for
// `reassign_team_client()`. No I/O — lib/manager-client-service.ts owns the
// actual RPC call and passes the returned `code` in here, same convention as
// lib/policies/po-confirmation-status-policy.ts.
//
// Codes match the LIVE, patched Migration 044 function body exactly
// (Migration-044-Report.md lines 129-176):
// reason_required | same_owner | role_not_eligible | new_owner_not_in_team |
// new_owner_not_eligible | stale_or_not_permitted | reassigned.
export type ReassignResponseCode =
  | 'reason_required'
  | 'same_owner'
  | 'role_not_eligible'
  | 'new_owner_not_in_team'
  | 'new_owner_not_eligible'
  | 'stale_or_not_permitted'
  | 'reassigned';

const REASSIGN_MESSAGES: Record<ReassignResponseCode, string> = {
  reason_required: 'Enter a reason before moving the client.',
  same_owner: 'The chosen agent is already this client\'s agent — pick a different one.',
  role_not_eligible: 'You don\'t have permission to move this client.',
  new_owner_not_in_team: 'The chosen agent is not on your team.',
  new_owner_not_eligible: 'The chosen agent can\'t take this client (inactive or ineligible role).',
  stale_or_not_permitted: 'This client was already moved to another agent — refresh and try again.',
  reassigned: 'The client was moved successfully.',
};

/** Maps a `reassign_team_client()` response `code` to a user-facing message. */
export function mapReassignResponseCode(code: ReassignResponseCode): string {
  return REASSIGN_MESSAGES[code];
}

/** `true` only for the single success code — every other code is a rejection. */
export function isReassignSuccess(code: ReassignResponseCode): boolean {
  return code === 'reassigned';
}
