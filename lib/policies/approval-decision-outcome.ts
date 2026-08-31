// Batch 6 PR B (ADR-052 section E): pure classification of a manager
// decision RPC's return code into the four UX buckets the Approvals detail
// screen (`app/(manager)/approvals/[id].tsx`) branches on. Both
// `decide_client_edit_request()` (lib/client-edit-decision-service.ts) and
// `decide_po_confirmation()` (lib/po-confirmation-manager-service.ts) share
// this vocabulary except `'base_conflict'`, which only the former can
// return — kept here as one function so the screen never has to maintain two
// near-identical switch statements for the two request kinds it mixes.
export type ApprovalDecisionOutcome = 'success' | 'already_decided' | 'conflict' | 'error';

export function classifyDecisionCode(code: string): ApprovalDecisionOutcome {
  if (code === 'approved' || code === 'rejected') return 'success';
  if (code === 'already_decided') return 'already_decided';
  if (code === 'base_conflict') return 'conflict';
  return 'error';
}

/**
 * One-line, agent-facing copy for a decision code that did NOT succeed.
 *
 * The detail screen (`approvals/[id].tsx`) branches on `classifyDecisionCode`
 * and renders a whole banner per bucket, which works when the screen shows one
 * request. A bulk approve decides many at once and can collect several
 * different refusals in a single run, so it needs each code as a short phrase
 * it can list — hence a second, finer mapping alongside the four-bucket one
 * rather than inside it.
 *
 * 'approved'/'rejected' are not failures and never reach here; they map to the
 * empty string so the function stays total.
 */
export function describeDecisionFailure(code: string): string {
  switch (code) {
    case 'approved':
    case 'rejected':
      return '';
    case 'already_decided':
      return 'already decided by someone else';
    case 'base_conflict':
      return 'the client record changed since it was filed';
    case 'role_not_eligible':
      return 'not yours to review';
    case 'not_found':
      return 'no longer exists';
    default:
      return "couldn't be processed";
  }
}
