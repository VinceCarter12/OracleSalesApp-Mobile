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
