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
  reason_required: 'Kailangan ng dahilan bago mag-reassign.',
  same_owner: 'Pareho ang bagong agent sa kasalukuyang agent — pumili ng ibang agent.',
  role_not_eligible: 'Hindi ka pinapayagang mag-reassign ng client na ito.',
  new_owner_not_in_team: 'Ang bagong agent ay wala sa team mo.',
  new_owner_not_eligible: 'Hindi puwedeng tanggapin ng napiling agent ang client na ito (inactive o hindi kwalipikadong role).',
  stale_or_not_permitted: 'Nailipat na ang client na ito sa ibang agent — i-refresh at subukan ulit.',
  reassigned: 'Matagumpay na na-reassign ang client.',
};

/** Maps a `reassign_team_client()` response `code` to a user-facing message. */
export function mapReassignResponseCode(code: ReassignResponseCode): string {
  return REASSIGN_MESSAGES[code];
}

/** `true` only for the single success code — every other code is a rejection. */
export function isReassignSuccess(code: ReassignResponseCode): boolean {
  return code === 'reassigned';
}
