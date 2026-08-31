// Bulk approve on the Manager Requests inbox (2026-08-31, Adrian) — the
// mobile half of the same feature shipped on web's `/approvals` page. A
// manager clearing a backlog approves several requests FROM ONE AGENT in a
// single gesture instead of opening `approvals/[id]` once per request.
//
// The eligibility rules below are deliberately narrow, and each exclusion is
// a decision rather than an oversight:
//
//   - `po_confirmation` is never bulk-approvable. A client edit is a field
//     diff the row already summarises; a PO is a photo the manager has to
//     open, and approving it fires `promote_on_po_confirmed` (web migration
//     040), promoting the client In Progress -> New in the same transaction.
//     Bulk-approving POs is bulk-approving evidence nobody looked at, and
//     nothing in this app undoes the promotion. They keep the single
//     Approve/Reject on the detail screen.
//
//   - `tag_along` is never bulk-approvable either. It is not an approval at
//     all — it is a companion invite the manager accepts or declines through
//     `updateCompanionRequestStatus()`, a different write path entirely, and
//     it already has inline Accept/Decline buttons on its own row.
//
//   - There is no bulk REJECT. A rejection is only actionable to the agent if
//     it says why (`approvals/[id].tsx` renders `reviewNote` for exactly that
//     reason), and one note cannot honestly cover a batch.
//
// One agent at a time is the rule Adrian asked for and also the safe one:
// "everything Marisa filed today" is a defensible unit of review, "nine rows
// I happened to tap" is not.

/**
 * The minimum a row must expose to take part in a selection. Structural on
 * purpose so this module stays pure and testable — it never imports
 * `ManagerRequestRow`, which drags in the whole feed service.
 */
export interface BulkSelectableRequest {
  requestId: string;
  kind: string;
  status: string;
  /** Null for tag-along rows, which carry an invitee record rather than an approval. */
  requesterId: string | null;
  requesterName: string;
}

export interface BulkSelection {
  /** The live selection: what the caller ticked, minus anything no longer on screen or no longer pending. */
  selectedIds: string[];
  /** Whose queue the selection belongs to — null when nothing is selected. */
  requesterId: string | null;
  requesterName: string | null;
  /** Every approvable request from that same requester, across ALL pages — what "Select all" ticks. */
  eligibleIds: string[];
}

/** Only a pending client-edit request from a known requester can join a batch. */
export function isBulkApprovable(row: BulkSelectableRequest): boolean {
  return row.kind === 'client_edit' && row.status === 'pending' && row.requesterId !== null;
}

/**
 * Resolve a set of tapped ids against the rows currently on screen.
 *
 * The caller's raw `selectedIds` is never pruned in place by an effect. It is
 * intersected with the visible approvable rows here, on every render, so
 * narrowing a filter — or a request being decided out from under the inbox by
 * an admin on web — drops it from the selection with no extra state write and
 * no chance of the two disagreeing. Ticks are remembered if the filter widens
 * again.
 *
 * `rows` must be the FILTERED set, not the current page: "select all 7" has to
 * mean all seven, including the four on page two. Pagination is a viewport
 * here, not a scope.
 */
export function resolveBulkSelection(
  rows: readonly BulkSelectableRequest[],
  selectedIds: readonly string[]
): BulkSelection {
  const approvable = rows.filter(isBulkApprovable);
  const byId = new Map(approvable.map((row) => [row.requestId, row]));
  const live = selectedIds.filter((id) => byId.has(id));

  if (live.length === 0) {
    return { selectedIds: [], requesterId: null, requesterName: null, eligibleIds: [] };
  }

  // Read off the first surviving tick rather than tracked separately, so the
  // owning agent can never drift from the selection itself.
  const owner = byId.get(live[0])!;
  const sameRequester = approvable.filter((row) => row.requesterId === owner.requesterId);

  return {
    // A selection can only ever hold one agent's requests, but the caller's
    // raw list is untrusted input (a stale tick from before a filter change
    // could name a different agent), so it is narrowed here too.
    selectedIds: live.filter((id) => byId.get(id)!.requesterId === owner.requesterId),
    requesterId: owner.requesterId,
    requesterName: owner.requesterName,
    eligibleIds: sameRequester.map((row) => row.requestId),
  };
}

/**
 * Whether a row should be shown as locked while a selection is open — an
 * approvable request that simply belongs to a different agent. Rows that were
 * never selectable (PO, tag-along, already decided) are NOT locked: they look
 * no different in selection mode, because they never offered a tick to begin
 * with, and dimming them would suggest the selection is what is holding them
 * back.
 */
export function isLockedBySelection(row: BulkSelectableRequest, selection: BulkSelection): boolean {
  return (
    selection.requesterId !== null &&
    isBulkApprovable(row) &&
    row.requesterId !== selection.requesterId
  );
}
