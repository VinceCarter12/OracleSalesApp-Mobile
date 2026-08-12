// Batch 6 PR D (ADR-052 section F "Entry Point Branching"): pure
// branch-selection logic for app/(tabs)/clients/complete.tsx's
// handleSubmit(), split out so the ordering rule is directly unit-testable
// without a DB/network round-trip. The order below is load-bearing — see
// Sprint.md's Batch 6 "Final Approved File/Function Plan" for the exact
// approved sequence.

export type CompleteInfoSubmitBranch =
  | 'blocked_pending' // Step 1: an existing pending client_edit_request already exists — block, show BizPendingBanner.
  | 'direct_first_time' // Step 2: every changed field is either approval-exempt (minor_notes) or was blank before this save (first-time fill of that field) — always direct, never gated.
  | 'direct_exempt_only' // Step 3: nothing changed at all — direct no-op save, any role.
  | 'direct_manager_owns' // Step 4: sales_manager editing their own assigned client — direct, version-checked, never a request.
  | 'request_approval'; // Step 5: sales_specialist/rsr, at least one already-set field changed — needs manager approval for just those fields.

// Per-field approval gating (2026-08-11, fixes B-10x: firstTime was a
// whole-record flag computed from isInfoComplete(), so any client left
// permanently partial stayed firstTime === true forever, silently
// defeating ADR-052's approval workflow for that record). The split is now
// computed once, from the actual before/after diff, by
// lib/complete-info-submit.ts's splitCompleteInfoChanges() — this function
// only decides which branch that split maps to.
export interface DetermineCompleteInfoSubmitBranchInput {
  hasPendingRequest: boolean;
  isManagerOwnClient: boolean;
  /** Changed fields that were already non-blank before this save — require manager approval. */
  approvalRequiredFields: readonly string[];
  /** Changed fields safe to write immediately: minor_notes (globally exempt) or any field whose OLD value was blank. */
  directApplyFields: readonly string[];
}

/**
 * ADR-052 section F, order is load-bearing: guard → nothing-requires-approval
 * → manager-owns → request. When no field in this save needs approval, the
 * write is always direct — 'direct_first_time' if at least one field was
 * actually written, 'direct_exempt_only' for a true no-op save (nothing
 * changed at all). A manager editing their own client stays direct
 * regardless of what changed, including an already-set field.
 */
export function determineCompleteInfoSubmitBranch(
  input: DetermineCompleteInfoSubmitBranchInput
): CompleteInfoSubmitBranch {
  if (input.hasPendingRequest) return 'blocked_pending';

  if (input.approvalRequiredFields.length === 0) {
    return input.directApplyFields.length > 0 ? 'direct_first_time' : 'direct_exempt_only';
  }

  if (input.isManagerOwnClient) return 'direct_manager_owns';

  return 'request_approval';
}
