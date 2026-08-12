import { computeClientEditChanges, normalizeForCompare } from './client-edit-request-payload';
import { CLIENT_EDITABLE_FIELDS, CLIENT_APPROVAL_EXEMPT_FIELDS } from './policies/approval-policy';
import { toRemoteSalesChannel, toRemoteCustomerType } from './remote-client-mapping';
import type { Client, SalesChannel } from '../types';

// Per-field approval gating (2026-08-11, fixes B-10x): split out of
// lib/complete-info-submit.ts into its own pure, I/O-free module — that
// file imports lib/client-service.ts (expo-sqlite, a native module),
// which vitest.config.ts's node environment can't parse (Flow syntax in
// react-native/index.js). Same "pure function tests only" split this repo
// already uses for lib/complete-info-branch.ts. Re-exported from
// complete-info-submit.ts so existing callers (the screen, submitCompleteInfo)
// see no import-path change.

export interface CompleteInfoFormValues {
  contactPerson: string;
  position: string;
  contactNumber: string;
  officeAddress: string;
  channel: SalesChannel;
  existingOverride: boolean;
  minorNotes: string;
}

// Company name is view-only on this screen (not in the wireframe's a-complete
// form — only Create Client's Phase A collects it) so it's never part of the
// before/after diff here.
export function buildBeforeAfter(client: Client, form: CompleteInfoFormValues): { before: Record<string, unknown>; after: Record<string, unknown> } {
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

export interface CompleteInfoFieldSplit {
  /** Changed fields safe to write immediately: minor_notes (globally exempt) or any field whose OLD value was blank (first-time fill of that specific field). */
  directApplyFields: string[];
  /** Changed fields that were already non-blank before this save — require manager approval. */
  approvalRequiredFields: string[];
}

/**
 * Per-field approval gating (2026-08-11, fixes B-10x): the single
 * definition of "does this field change need approval," shared by the
 * screen (live, every render, for UI copy/button state) and
 * lib/complete-info-submit.ts (at save time). A changed field is
 * direct-apply when it's globally exempt (minor_notes) or was blank before
 * this save; otherwise it requires manager approval — regardless of
 * whether other fields on the same record are still blank, and regardless
 * of client lifecycle status.
 */
export function splitCompleteInfoChanges(client: Client, form: CompleteInfoFormValues): CompleteInfoFieldSplit {
  const { before, after } = buildBeforeAfter(client, form);
  const diff = computeClientEditChanges(before, after, CLIENT_EDITABLE_FIELDS);
  const split: CompleteInfoFieldSplit = { directApplyFields: [], approvalRequiredFields: [] };
  for (const field of Object.keys(diff)) {
    const isExempt = (CLIENT_APPROVAL_EXEMPT_FIELDS as readonly string[]).includes(field);
    const wasBlank = normalizeForCompare(diff[field].old) === null;
    if (isExempt || wasBlank) {
      split.directApplyFields.push(field);
    } else {
      split.approvalRequiredFields.push(field);
    }
  }
  return split;
}

// Field-write shape lib/complete-info-submit.ts's 'request_approval' branch
// passes to client-service.ts's updateClientInfo() (minus clientId/agentId,
// which only the orchestrator has). Kept as its own interface rather than
// importing UpdateClientInfoInput from lib/client-service.ts so this file
// stays free of that native-module import (see this file's header).
export interface CompleteInfoHeldWriteFields {
  contactPerson: string;
  position: string;
  contactNumber: string;
  officeAddress: string;
  salesChannel: SalesChannel | null;
  markExisting?: boolean;
  minorNotes: string;
}

/**
 * request_approval branch only (2026-08-11, fixes B-10x + quality-gate
 * follow-up): every directApplyFields entry (minor_notes, or any field that
 * was blank before this save) is written with its NEW form value; every
 * approvalRequiredFields entry is held at its OLD client value so the
 * pending change isn't applied early — the request_approval-only
 * client_edit_requests row carries those instead. Pulled out of
 * submitCompleteInfo() so it's directly unit-testable without mocking
 * expo-sqlite and to keep that function under the 40-line limit
 * (`.claude/rules/10-coding-standards.md`).
 */
export function buildHeldWriteInput(
  client: Client,
  form: CompleteInfoFormValues,
  approvalRequiredFields: readonly string[]
): CompleteInfoHeldWriteFields {
  const holdsForApproval = (field: string): boolean => approvalRequiredFields.includes(field);
  return {
    contactPerson: holdsForApproval('contact_person') ? client.contact_person : form.contactPerson,
    position: holdsForApproval('contact_position') ? client.position ?? '' : form.position,
    contactNumber: holdsForApproval('contact_number') ? client.contact_number ?? '' : form.contactNumber,
    officeAddress: holdsForApproval('office_address') ? client.office_address ?? '' : form.officeAddress,
    salesChannel: holdsForApproval('sales_channel') ? client.sales_channel : form.channel,
    markExisting: !holdsForApproval('customer_type') && form.existingOverride ? true : undefined,
    minorNotes: holdsForApproval('minor_notes') ? client.minor_notes ?? '' : form.minorNotes,
  };
}
