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

// Vince's locked decision (2026-08-11): distinct, explanatory Tagalog copy
// for the two pending-request codes, not a generic block message.
const DECLARE_MESSAGES: Record<LostOpportunityDeclareCode, string> = {
  declared: 'Naideklara ang client bilang Lost Opportunity.',
  reason_required: 'Ilagay ang Lost Opportunity reason bago kumpirmahin.',
  not_found: 'Hindi nahanap ang client na ito.',
  role_not_eligible: 'Hindi ka pinapayagang i-declare lost ang client na ito.',
  already_lost: 'Naideklara na dati ang client na ito bilang lost.',
  pending_edit_request:
    'May nakabinbing pagbabago pa sa impormasyon ng client na ito na naghihintay ng approval ng manager. Hindi muna pwedeng i-declare lost hangga’t hindi ito na-desisyunan.',
  pending_po_confirmation:
    'May nakabinbing PO confirmation approval pa ang client na ito. Hindi muna pwedeng i-declare lost hangga’t hindi ito na-desisyunan.',
};

/** Maps a `declare_client_lost()` response `code` to a user-facing message. */
export function mapLostOpportunityDeclareCode(code: LostOpportunityDeclareCode): string {
  return DECLARE_MESSAGES[code];
}

/** `true` only for the single success code — every other code is a rejection. */
export function isDeclareSuccess(code: LostOpportunityDeclareCode): boolean {
  return code === 'declared';
}
