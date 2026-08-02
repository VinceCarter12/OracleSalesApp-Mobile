// Batch 6 PR D (ADR-052 section F "Entry Point Branching"): pure
// branch-selection logic for app/(tabs)/clients/complete.tsx's
// handleSubmit(), split out so the ordering rule is directly unit-testable
// without a DB/network round-trip. The order below is load-bearing — see
// Sprint.md's Batch 6 "Final Approved File/Function Plan" for the exact
// approved sequence.

export type CompleteInfoSubmitBranch =
  | 'blocked_pending' // Step 1: an existing pending client_edit_request already exists — block, show BizPendingBanner.
  | 'direct_first_time' // Step 2: first-time completion (Wireframe a-complete Phase B) — always direct, never gated.
  | 'direct_exempt_only' // Step 3: only approval-EXEMPT fields (minor_notes) changed — direct, any role.
  | 'direct_manager_owns' // Step 4: sales_manager editing their own assigned client — direct, version-checked, never a request.
  | 'request_approval'; // Step 5: sales_specialist/rsr, at least one approval-required field changed.

export interface DetermineCompleteInfoSubmitBranchInput {
  hasPendingRequest: boolean;
  firstTime: boolean;
  isManagerOwnClient: boolean;
  /** Every field (out of the 8 CLIENT_EDITABLE_FIELDS) that is actually dirty this save. */
  changedFields: readonly string[];
  /** CLIENT_APPROVAL_EXEMPT_FIELDS — currently just ['minor_notes']. */
  exemptFields: readonly string[];
}

/**
 * ADR-052 section F, order is load-bearing: guard → firstTime → exempt-only
 * → manager-owns → request. Step 3 (exempt-only) is evaluated BEFORE step 4
 * (manager-owns) specifically so a manager editing only minor_notes takes
 * the cheap exempt path — but a manager changing anything else, even
 * alongside minor_notes, still falls through to step 4's direct-write
 * (never creates a request either way; the distinction only matters for
 * which write path is taken, not whether approval is required).
 */
export function determineCompleteInfoSubmitBranch(
  input: DetermineCompleteInfoSubmitBranchInput
): CompleteInfoSubmitBranch {
  if (input.hasPendingRequest) return 'blocked_pending';
  if (input.firstTime) return 'direct_first_time';

  const hasNonExemptChange = input.changedFields.some((field) => !input.exemptFields.includes(field));
  if (!hasNonExemptChange) return 'direct_exempt_only';

  if (input.isManagerOwnClient) return 'direct_manager_owns';

  return 'request_approval';
}
