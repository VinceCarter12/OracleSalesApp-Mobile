// Migration 088 (`declare_client_lost()`): pure response-code -> user-message
// mapping, same convention as lib/policies/lost-opportunity-claim-policy.ts.
// No I/O — lib/lost-opportunity-declare-service.ts passes the RPC's `code`
// in here.
//
// Codes match the LIVE Migration 088 function body exactly: declared |
// reason_required | not_found | role_not_eligible | already_lost |
// pending_edit_request | pending_po_confirmation.
export type LostOpportunityDeclareCode =
  | 'declared'
  | 'reason_required'
  | 'not_found'
  | 'role_not_eligible'
  | 'already_lost'
  | 'pending_edit_request'
  | 'pending_po_confirmation';

// Vince's locked decision (2026-08-11): distinct, explanatory English copy
// for the two pending-request codes, not a generic block message.
const DECLARE_MESSAGES: Record<LostOpportunityDeclareCode, string> = {
  declared: 'This client has been declared a Lost Opportunity.',
  reason_required: 'Enter a Lost Opportunity reason before confirming.',
  not_found: 'This client could not be found.',
  role_not_eligible: 'You don\'t have permission to declare this client lost.',
  already_lost: 'This client was already declared lost before.',
  pending_edit_request:
    'This client still has pending changes waiting for your manager\'s approval. It can\'t be declared lost until that is decided.',
  pending_po_confirmation:
    'This client still has a pending purchase order confirmation waiting for approval. It can\'t be declared lost until that is decided.',
};

/** Maps a `declare_client_lost()` response `code` to a user-facing message. */
export function mapLostOpportunityDeclareCode(code: LostOpportunityDeclareCode): string {
  return DECLARE_MESSAGES[code];
}

/** `true` only for the single success code — every other code is a rejection. */
export function isDeclareSuccess(code: LostOpportunityDeclareCode): boolean {
  return code === 'declared';
}
