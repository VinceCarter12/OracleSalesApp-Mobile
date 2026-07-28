// ADR-041 (Migration 037): pure response-code -> user-message mapping for
// `claim_lost_opportunity()`. No I/O — a future claim-service call site
// passes the returned `code` in here, same convention as
// lib/policies/po-confirmation-status-policy.ts and
// lib/policies/reassignment-response-policy.ts.
//
// Codes match the LIVE Migration 037 function body exactly
// (Migration-037-Report.md lines 50-129):
// claimed | role_not_eligible | former_owner_excluded | cooling_down |
// not_found_or_not_lost | already_claimed.
export type LostOpportunityClaimCode =
  | 'claimed'
  | 'role_not_eligible'
  | 'former_owner_excluded'
  | 'cooling_down'
  | 'not_found_or_not_lost'
  | 'already_claimed';

const CLAIM_MESSAGES: Record<LostOpportunityClaimCode, string> = {
  claimed: 'Matagumpay na na-claim ang opportunity. Nasa My Clients mo na ito.',
  role_not_eligible: 'Hindi ka pinapayagang mag-claim ng lost opportunity.',
  // Permanent, across ALL historical cycles (Vince, 2026-07-26/27) — not just
  // the immediately-previous owner. Copy must not imply this is temporary.
  former_owner_excluded: 'Hindi mo puwedeng i-claim ang client na ito dahil dating agent mo na ito.',
  // 1-month cooldown per Migration 036's `reassignable_at`.
  cooling_down: 'Hindi pa ito puwedeng i-claim — nasa cooldown period pa.',
  not_found_or_not_lost: 'Hindi na available ang opportunity na ito.',
  already_claimed: 'Na-claim na ng ibang agent ang opportunity na ito.',
};

/** Maps a `claim_lost_opportunity()` response `code` to a user-facing message. */
export function mapLostOpportunityClaimCode(code: LostOpportunityClaimCode): string {
  return CLAIM_MESSAGES[code];
}

/** `true` only for the single success code — every other code is a rejection. */
export function isClaimSuccess(code: LostOpportunityClaimCode): boolean {
  return code === 'claimed';
}

const CLAIM_ELIGIBLE_ROLES = ['sales_specialist', 'rsr'] as const;
export type ClaimEligibleRole = (typeof CLAIM_ELIGIBLE_ROLES)[number];

/**
 * `sales_manager` (and every other role) is view-only for Lost Opportunities
 * per ADR-039 — only `sales_specialist`/`rsr` may claim (Migration 037's own
 * server-side check, mirrored here so the UI can hide/disable the action
 * before ever calling the RPC).
 */
export function canClaimLostOpportunity(role: string | null | undefined): boolean {
  return CLAIM_ELIGIBLE_ROLES.includes(role as ClaimEligibleRole);
}
