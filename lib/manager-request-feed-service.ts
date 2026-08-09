import {
  fetchManagerApprovalFeed,
  type ApprovalDecisionStatus,
  type ManagerApprovalFeedRow,
} from './manager-approval-feed-service';
import { getIncomingCompanionRequests, type IncomingCompanionRequest } from './tag-along-invitee-service';

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
    // Every row reaching here already passed the `status === 'pending'`
    // filter below — a decided tag-along disappears from this feed the same
    // way the old `app/(manager)/tag-along.tsx` dropped it after `load()`.
    status: 'pending',
    createdAt: row.createdAt,
    requesterName,
    clientName: row.clientName ?? 'Client',
    summary: `Kasama sana kita: ${requesterName}`,
    tagAlong: row,
  };
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

  const rows: ManagerRequestRow[] = [
    ...approvalRows.map(toApprovalRow),
    ...tagAlongRows.filter((r) => r.status === 'pending').map(toTagAlongRow),
  ];

  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
