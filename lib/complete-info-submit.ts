import { updateClientInfo } from './client-service';
import { createClientEditRequest, type ClientEditRequest } from './client-edit-request-service';
import { computeClientEditChanges } from './client-edit-request-payload';
import { determineCompleteInfoSubmitBranch, type CompleteInfoSubmitBranch } from './complete-info-branch';
import {
  buildBeforeAfter,
  buildHeldWriteInput,
  splitCompleteInfoChanges,
  type CompleteInfoFieldSplit,
  type CompleteInfoFormValues,
} from './complete-info-field-split';
import { isValidContactNumber, CONTACT_NUMBER_INVALID_MESSAGE } from './field-validation';
import type { Client } from '../types';

// Re-exported so existing callers (the screen) can keep importing these
// from this module — the actual implementation is the pure,
// I/O-free lib/complete-info-field-split.ts (see that file's header for why).
export { buildBeforeAfter, splitCompleteInfoChanges, type CompleteInfoFormValues, type CompleteInfoFieldSplit };

// Batch 6 PR D: orchestration split out of app/(tabs)/clients/complete.tsx
// (which only renders + owns form state) to keep that file under the
// 300-line limit and out of the "hooks/services do business logic,
// components render" split (_meta/engineering-principles.md). Throws the
// same error types the screen already caught pre-Batch-6
// (AccountSuspendedError via updateClientInfo/createClientEditRequest,
// ClientNotFoundLocallyError) — the screen's try/catch is unchanged in
// shape, just now wrapping this call instead of a single updateClientInfo()
// call. Company name became view-only here (no longer part of this form),
// so DuplicateCompanyNameError can no longer surface from this path.

export interface SubmitCompleteInfoInput {
  client: Client;
  clientId: string;
  profileId: string;
  pendingRequest: ClientEditRequest | null;
  isManagerOwnClient: boolean;
  form: CompleteInfoFormValues;
}

// direct_first_time/direct_manager_owns/direct_exempt_only: nothing needs
// approval, so every field is written straight from the form. Only
// exempt_only (a true no-op save) omits markExisting — the other two
// branches apply it whenever the user toggled "Existing client".
async function writeDirectBranch(
  clientId: string,
  profileId: string,
  form: CompleteInfoFormValues,
  branch: 'direct_first_time' | 'direct_manager_owns' | 'direct_exempt_only',
  expectedUpdatedAt: string | undefined
): Promise<void> {
  await updateClientInfo({
    clientId,
    agentId: profileId,
    contactPerson: form.contactPerson,
    position: form.position,
    contactNumber: form.contactNumber,
    officeAddress: form.officeAddress,
    salesChannel: form.channel,
    minorNotes: form.minorNotes,
    ...(branch === 'direct_manager_owns' && expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
    ...(branch === 'direct_exempt_only' ? {} : { markExisting: form.existingOverride || undefined }),
  });
}

// sales_specialist/rsr, at least one already-set field changed. Every
// directApplyFields entry is written FIRST with its NEW form value; every
// approvalRequiredFields entry is held at its OLD client value
// (buildHeldWriteInput) so the pending change isn't applied early. This
// write must land before createClientEditRequest() reads clients.updated_at
// as base_updated_at, or our own write would look like a conflicting edit
// at decision time (see client-edit-request-payload.ts's baseUpdatedAt doc
// comment).
async function writeRequestApprovalBranch(
  client: Client,
  clientId: string,
  profileId: string,
  form: CompleteInfoFormValues,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  directApplyFields: readonly string[],
  approvalRequiredFields: readonly string[]
): Promise<void> {
  if (directApplyFields.length > 0) {
    await updateClientInfo({
      clientId,
      agentId: profileId,
      ...buildHeldWriteInput(client, form, approvalRequiredFields),
    });
  }
  const approvalChanges = computeClientEditChanges(before, after, approvalRequiredFields);
  await createClientEditRequest(clientId, profileId, approvalChanges);
}

/**
 * Runs the ADR-052 section F branch (see lib/complete-info-branch.ts for the
 * exact order) and performs the corresponding write(s). Returns the branch
 * taken so the caller can pick the matching toast copy; `'blocked_pending'`
 * means nothing was written (the caller's UI-level gate should normally
 * prevent reaching this at all — this is the defense-in-depth check).
 */
export async function submitCompleteInfo(input: SubmitCompleteInfoInput): Promise<CompleteInfoSubmitBranch> {
  const { client, clientId, profileId, form } = input;

  // 2026-08-09 field validation (defense-in-depth): the screen gates too, but
  // this write-path guard guarantees an invalid phone can never reach SQLite/
  // the outbox regardless of caller. Optional field — blank is fine.
  const trimmedNumber = form.contactNumber.trim();
  if (trimmedNumber !== '' && !isValidContactNumber(trimmedNumber)) {
    throw new Error(CONTACT_NUMBER_INVALID_MESSAGE);
  }

  const { before, after } = buildBeforeAfter(client, form);
  const { directApplyFields, approvalRequiredFields } = splitCompleteInfoChanges(client, form);
  const branch = determineCompleteInfoSubmitBranch({
    hasPendingRequest: input.pendingRequest !== null,
    isManagerOwnClient: input.isManagerOwnClient,
    directApplyFields,
    approvalRequiredFields,
  });

  if (branch === 'blocked_pending') return branch;

  if (branch === 'direct_first_time' || branch === 'direct_manager_owns' || branch === 'direct_exempt_only') {
    await writeDirectBranch(clientId, profileId, form, branch, branch === 'direct_manager_owns' ? client.updated_at : undefined);
    return branch;
  }

  await writeRequestApprovalBranch(client, clientId, profileId, form, before, after, directApplyFields, approvalRequiredFields);
  return branch;
}
