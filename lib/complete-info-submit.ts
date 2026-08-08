import { updateClientInfo } from './client-service';
import { createClientEditRequest, type ClientEditRequest } from './client-edit-request-service';
import { computeClientEditChanges } from './client-edit-request-payload';
import { determineCompleteInfoSubmitBranch, type CompleteInfoSubmitBranch } from './complete-info-branch';
import { CLIENT_EDITABLE_FIELDS, CLIENT_APPROVAL_EXEMPT_FIELDS, getFieldsRequiringApproval } from './policies/approval-policy';
import { toRemoteSalesChannel, toRemoteCustomerType } from './remote-client-mapping';
import type { Client, SalesChannel } from '../types';

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

export interface CompleteInfoFormValues {
  contactPerson: string;
  position: string;
  contactNumber: string;
  officeAddress: string;
  channel: SalesChannel;
  existingOverride: boolean;
  minorNotes: string;
}

export interface SubmitCompleteInfoInput {
  client: Client;
  clientId: string;
  profileId: string;
  pendingRequest: ClientEditRequest | null;
  firstTime: boolean;
  isManagerOwnClient: boolean;
  form: CompleteInfoFormValues;
}

// Company name is view-only on this screen (not in the wireframe's a-complete
// form — only Create Client's Phase A collects it) so it's never part of the
// before/after diff here.
function buildBeforeAfter(client: Client, form: CompleteInfoFormValues): { before: Record<string, unknown>; after: Record<string, unknown> } {
  return {
    before: {
      contact_person: client.contact_person,
      contact_position: client.position ?? null,
      contact_number: client.contact_number ?? null,
      office_address: client.office_address ?? null,
      sales_channel: toRemoteSalesChannel(client.sales_channel),
      customer_type: toRemoteCustomerType(client.status),
      minor_notes: client.minor_notes ?? null,
    },
    after: {
      contact_person: form.contactPerson.trim(),
      contact_position: form.position.trim() || null,
      contact_number: form.contactNumber.trim() || null,
      office_address: form.officeAddress.trim() || null,
      sales_channel: toRemoteSalesChannel(form.channel),
      customer_type: form.existingOverride ? 'existing' : toRemoteCustomerType(client.status),
      minor_notes: form.minorNotes.trim() || null,
    },
  };
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
  const { before, after } = buildBeforeAfter(client, form);
  const fullDiff = computeClientEditChanges(before, after, CLIENT_EDITABLE_FIELDS);
  const branch = determineCompleteInfoSubmitBranch({
    hasPendingRequest: input.pendingRequest !== null,
    firstTime: input.firstTime,
    isManagerOwnClient: input.isManagerOwnClient,
    changedFields: Object.keys(fullDiff),
    exemptFields: CLIENT_APPROVAL_EXEMPT_FIELDS,
  });

  if (branch === 'blocked_pending') return branch;

  if (branch === 'direct_first_time' || branch === 'direct_manager_owns') {
    await updateClientInfo({
      clientId,
      agentId: profileId,
      contactPerson: form.contactPerson,
      position: form.position,
      contactNumber: form.contactNumber,
      officeAddress: form.officeAddress,
      salesChannel: form.channel,
      markExisting: form.existingOverride || undefined,
      minorNotes: form.minorNotes,
    });
    return branch;
  }

  if (branch === 'direct_exempt_only') {
    await updateClientInfo({
      clientId,
      agentId: profileId,
      contactPerson: form.contactPerson,
      position: form.position,
      contactNumber: form.contactNumber,
      officeAddress: form.officeAddress,
      salesChannel: form.channel,
      minorNotes: form.minorNotes,
    });
    return branch;
  }

  // branch === 'request_approval': sales_specialist/rsr, at least one
  // approval-required field changed. minor_notes (if also dirty) is
  // written FIRST — it must land before createClientEditRequest() reads
  // clients.updated_at as base_updated_at, or our own write would look
  // like a conflicting edit at decision time (see
  // client-edit-request-payload.ts's baseUpdatedAt doc comment).
  if (Object.prototype.hasOwnProperty.call(fullDiff, 'minor_notes')) {
    await updateClientInfo({
      clientId,
      agentId: profileId,
      contactPerson: client.contact_person,
      position: client.position ?? '',
      contactNumber: client.contact_number ?? '',
      officeAddress: client.office_address ?? '',
      salesChannel: client.sales_channel,
      minorNotes: form.minorNotes,
    });
  }
  const approvalChanges = computeClientEditChanges(before, after, getFieldsRequiringApproval('clients'));
  await createClientEditRequest(clientId, profileId, approvalChanges);
  return branch;
}
