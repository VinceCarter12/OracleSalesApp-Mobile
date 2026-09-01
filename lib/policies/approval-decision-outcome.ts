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

/**
 * The detail behind a `'base_conflict'`, as `explain_client_edit_conflict()`
 * (migration 128) returns it.
 *
 * Every field but `reason` is optional because the RPC only includes the keys
 * belonging to the reason it reports.
 */
export interface ClientEditConflictDetail {
  reason: string;
  current_agent_name?: string | null;
  po_decided_at?: string | null;
  field?: string | null;
  expected_old?: string | null;
  current_value?: string | null;
}

/** Fallback copy — also what a manager sees when the explain call itself fails. */
export const GENERIC_CONFLICT_MESSAGE = 'Client record changed — please review again.';

/**
 * A conflict reason as a manager should read it.
 *
 * Pure, so it is unit-testable the way `describeDecisionFailure` above is, and
 * so the detail screen and the bulk toast cannot drift into two wordings.
 *
 * `'stage_already_new'` deliberately does NOT say "review again": migration
 * 129 auto-rejects those the moment the promotion lands, so by the time a
 * manager reads this the request is usually already gone. Telling them to
 * re-review something that no longer exists is the failure this replaces.
 */
export function describeConflictReason(detail: ClientEditConflictDetail | null): string {
  if (!detail) return GENERIC_CONFLICT_MESSAGE;

  switch (detail.reason) {
    case 'reassigned':
      return detail.current_agent_name
        ? `This client now belongs to ${detail.current_agent_name}. The request was filed against the previous agent's assignment.`
        : 'This client was reassigned to another agent since the request was filed.';
    case 'lost':
      return 'This client has been marked as lost, so their details can no longer be changed.';
    case 'stage_already_new':
      // No date when the client reached 'new' through the tag-along path
      // rather than a PO — the sentence has to read correctly either way.
      return detail.po_decided_at
        ? `This client was already promoted to New by a PO approved on ${formatConflictDate(detail.po_decided_at)}. Reject this request if it is no longer needed.`
        : 'This client has already closed a deal and is now New. Reject this request if it is no longer needed.';
    case 'field_changed':
      return `${getConflictFieldLabel(detail.field)} is now ${detail.current_value ?? 'blank'}, which is not what this request was filed against. The agent should resubmit.`;
    case 'none':
      return 'That conflict has cleared — try approving again.';
    default:
      return GENERIC_CONFLICT_MESSAGE;
  }
}

function formatConflictDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Field labels, duplicated rather than imported from
 * `lib/client-edit-field-labels.ts`: that module's `getClientEditFieldLabel`
 * is built for the diff box and falls back to the raw column name, which is
 * fine inside a labelled diff row but reads as a leak in a sentence.
 */
const CONFLICT_FIELD_LABEL: Record<string, string> = {
  company_name: 'The company name',
  contact_person: 'The contact person',
  contact_position: 'The contact position',
  contact_number: 'The contact number',
  office_address: 'The office address',
  sales_channel: 'The sales channel',
  customer_type: 'The customer type',
};

function getConflictFieldLabel(field: string | null | undefined): string {
  return (field && CONFLICT_FIELD_LABEL[field]) || 'A field on this client';
}
