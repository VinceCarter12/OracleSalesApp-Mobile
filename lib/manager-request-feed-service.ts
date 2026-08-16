import {
  fetchManagerApprovalFeed,
  type ApprovalDecisionStatus,
  type ManagerApprovalFeedRow,
} from './manager-approval-feed-service';
import { getIncomingCompanionRequests, type IncomingCompanionRequest } from './tag-along-invitee-service';
import { getMyPoConfirmationStatuses } from './po-confirmation-service';
import { getClientById } from './client-service';

// Manager Requests inbox (design-only merge, 2026-08-10): combines the
// Manager Approvals inbox (`fetchManagerApprovalFeed()` — client_edit +
// po_confirmation) with the Manager Tag-Along invitee feed
// (`getIncomingCompanionRequests()`) into a single union feed, mirroring the
// Sales "My Requests" precedent that already merges the same three request
// kinds on the requester side (`lib/my-request-status-service.ts`,
// `app/(tabs)/more/my-requests/index.tsx`). Same precedent that removed the
// Sales-side dedicated "Tag-Along Status" screen 2026-08-09 in favor of one
// combined inbox (`lib/tag-along-service.ts#getMyCompanionRequests` doc
// comment) — this does the equivalent collapse on the Manager side. No new
// RPC/query: both underlying reads are reused as-is, only reshaped.

export type ManagerRequestKind = 'client_edit' | 'po_confirmation' | 'tag_along';

interface ManagerRequestRowBase {
  requestId: string;
  status: ApprovalDecisionStatus;
  createdAt: string;
  requesterName: string;
  clientName: string;
  /** Single display line — field count, "PO evidence attached", or the tag-along ask. */
  summary: string;
}

export type ManagerRequestRow =
  | (ManagerRequestRowBase & {
      kind: 'client_edit' | 'po_confirmation';
      /** Original approvals-feed row — carries the review note + is what `approvals/[id].tsx` looks up by `requestId`. */
      approval: ManagerApprovalFeedRow;
    })
  | (ManagerRequestRowBase & {
      kind: 'tag_along';
      /** Original invitee-side row — `id` is the same value as `requestId`, kept for `updateCompanionRequestStatus()`. */
      tagAlong: IncomingCompanionRequest;
    });

function toApprovalRow(row: ManagerApprovalFeedRow): ManagerRequestRow {
  const summary =
    row.requestKind === 'client_edit'
      ? `${row.summary.fieldCount} field${row.summary.fieldCount === 1 ? '' : 's'} changed`
      : 'PO evidence attached';
  return {
    requestId: row.requestId,
    kind: row.requestKind,
    status: row.status,
    createdAt: row.createdAt,
    requesterName: row.requesterName,
    clientName: row.clientName,
    summary,
    approval: row,
  };
}

function toTagAlongRow(row: IncomingCompanionRequest): ManagerRequestRow {
  const requesterName = row.requesterName ?? 'Agent';
  return {
    requestId: row.id,
    kind: 'tag_along',
    // Unlike the old `app/(manager)/tag-along.tsx`, this feed intentionally
    // keeps decided rows (not just pending) so approved/declined Tag-Along
    // stays visible as read-only Manager history. Tag-along uses accepted /
    // declined remotely, while this unified screen uses approval badges.
    status: row.status === 'accepted' ? 'approved' : row.status === 'declined' ? 'rejected' : 'pending',
    createdAt: row.createdAt,
    requesterName,
    clientName: row.clientName ?? 'Client',
    summary: `Kasama sana kita: ${requesterName}`,
    tagAlong: row,
  };
}

/**
 * Manager-authored Close Deal records are auto-approved server-side. Keep a
 * local requester-side fallback here so the Manager still sees their own PO
 * history even if the team approval RPC has not returned that just-synced row.
 */
async function getOwnPoHistory(profileId: string, existingIds: Set<string>): Promise<ManagerRequestRow[]> {
  const records = await getMyPoConfirmationStatuses(profileId);
  const rows = await Promise.all(records.map(async (record) => {
    if (existingIds.has(record.id) || !['pending', 'approved', 'rejected'].includes(record.displayStatus)) return null;
    const client = await getClientById(record.clientId);
    const approval: ManagerApprovalFeedRow = {
      requestId: record.id,
      requestKind: 'po_confirmation',
      requesterId: profileId,
      requesterName: 'You',
      clientId: record.clientId,
      clientName: client?.company_name ?? 'Client',
      status: record.displayStatus as ApprovalDecisionStatus,
      createdAt: record.createdAt,
      decidedAt: record.displayStatus === 'pending' ? null : record.updatedAt,
      summary: { poPhotoPath: record.poPhotoPath, meetingId: record.meetingId },
    };
    return toApprovalRow(approval);
  }));
  return rows.filter((row): row is ManagerRequestRow => row !== null);
}

/**
 * Full team inbox — always unscoped by `managerScope` (ADR-052 section G),
 * same as `fetchManagerApprovalFeed()` alone was before this merge. `profileId`
 * is the signed-in manager, needed for the tag-along invitee read.
 */
export async function fetchManagerRequestFeed(profileId: string): Promise<ManagerRequestRow[]> {
  const [approvalRows, tagAlongRows] = await Promise.all([
    fetchManagerApprovalFeed(),
    getIncomingCompanionRequests(profileId),
  ]);

  const ownPoRows = await getOwnPoHistory(profileId, new Set(approvalRows.map((row) => row.requestId)));

  const rows: ManagerRequestRow[] = [
    ...approvalRows.map(toApprovalRow),
    ...ownPoRows,
    ...tagAlongRows.map(toTagAlongRow),
  ];

  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
