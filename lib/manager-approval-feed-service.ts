import { supabase } from './supabase';
import { getManagerApprovalFeed, type ManagerApprovalFeedItem } from './po-confirmation-manager-service';
import { PO_CONFIRMATION_REQUEST_KIND } from './policies/po-confirmation-status-policy';
import type { ClientEditRequestChanges } from './client-edit-request-payload';
import type { RemoteApprovalRequestKind } from '../types/database';

// ADR-052 (Batch 6 PR B, 2026-08-02): the Manager Approvals inbox
// (`app/(manager)/approvals/`) only surfaces client-edit and PO-confirmation
// requests — tag-along requests keep their own dedicated
// accept/decline flow (`app/(manager)/tag-along.tsx`,
// Wireframe-Manager-BizLink.html line 687: "Ang tag-along ay nananatiling
// nasa sarili nitong Tag-Along Requests flow"). This module reuses
// `getManagerApprovalFeed()` (the single `get_manager_approval_feed()` RPC
// call site, `lib/po-confirmation-manager-service.ts`) rather than
// duplicating that RPC call, then narrows + reshapes its rows into the
// display-ready shape this screen needs (human-readable requester/client
// names, camelCase per-kind summaries).

export const CLIENT_EDIT_REQUEST_KIND = 'client_edit' as const;

/** The two request kinds this inbox owns — `tag_along` is filtered out below. */
export type ApprovalRequestKind = Extract<RemoteApprovalRequestKind, 'client_edit' | 'po_confirmation'>;

const INBOX_KINDS: readonly ApprovalRequestKind[] = [CLIENT_EDIT_REQUEST_KIND, PO_CONFIRMATION_REQUEST_KIND];

/**
 * The feed RPC can also carry `'cancelled'` for `po_confirmation` rows
 * (`RemotePoConfirmationStatus`, types/database.ts) — out of scope for this
 * batch's approve/reject inbox (no cancellation UX exists here), so those
 * rows are excluded by `isDecisionStatus` rather than force-cast into a
 * status this screen has no way to render.
 */
export type ApprovalDecisionStatus = 'pending' | 'approved' | 'rejected';

export interface ClientEditFeedSummary {
  changes: ClientEditRequestChanges;
  fieldCount: number;
  reviewNote: string | null;
}

export interface PoConfirmationFeedSummary {
  poPhotoPath: string;
  meetingId: string;
}

interface ManagerApprovalFeedRowBase {
  requestId: string;
  requesterId: string;
  requesterName: string;
  clientId: string;
  clientName: string;
  status: ApprovalDecisionStatus;
  createdAt: string;
  decidedAt: string | null;
}

export type ManagerApprovalFeedRow =
  | (ManagerApprovalFeedRowBase & { requestKind: 'client_edit'; summary: ClientEditFeedSummary })
  | (ManagerApprovalFeedRowBase & { requestKind: 'po_confirmation'; summary: PoConfirmationFeedSummary });

interface ProfileNameRow {
  id: string;
  full_name: string;
}

interface ClientNameRow {
  id: string;
  company_name: string;
}

// Raw RPC summary shapes (snake_case, as returned by Postgres jsonb) — see
// ADR-052 section A "Supporting RPCs" and the pre-existing `po_confirmation`
// shape documented on `ManagerApprovalFeedItem.summary` above.
interface RemoteClientEditSummary {
  changes: ClientEditRequestChanges;
  field_count: number;
  review_note: string | null;
}

interface RemotePoConfirmationSummary {
  po_photo_path: string;
  meeting_id: string;
}

function isInboxKind(kind: RemoteApprovalRequestKind): kind is ApprovalRequestKind {
  return (INBOX_KINDS as readonly string[]).includes(kind);
}

function isDecisionStatus(status: string): status is ApprovalDecisionStatus {
  return status === 'pending' || status === 'approved' || status === 'rejected';
}

async function fetchProfileNamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', ids);
  if (error) throw error;
  return new Map(((data ?? []) as ProfileNameRow[]).map((p) => [p.id, p.full_name]));
}

async function fetchClientNamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('clients').select('id, company_name').in('id', ids);
  if (error) throw error;
  return new Map(((data ?? []) as ClientNameRow[]).map((c) => [c.id, c.company_name]));
}

// `item.summary` (Migration-042-Report.md) is typed `Record<string, unknown>`
// at its RPC boundary — narrowed here via `unknown` (not a direct
// `Record<string, unknown>` → named-type cast, which TS correctly flags as
// insufficiently overlapping) into each kind's known raw shape.
function toClientEditSummary(raw: unknown): ClientEditFeedSummary {
  const summary = raw as RemoteClientEditSummary;
  const changes = summary.changes ?? {};
  return {
    changes,
    fieldCount: summary.field_count ?? Object.keys(changes).length,
    reviewNote: summary.review_note ?? null,
  };
}

function toPoConfirmationSummary(raw: unknown): PoConfirmationFeedSummary {
  const summary = raw as RemotePoConfirmationSummary;
  return { poPhotoPath: summary.po_photo_path, meetingId: summary.meeting_id };
}

function toFeedRow(
  item: ManagerApprovalFeedItem,
  nameByRequesterId: Map<string, string>,
  nameByClientId: Map<string, string>
): ManagerApprovalFeedRow {
  const base: ManagerApprovalFeedRowBase = {
    requestId: item.requestId,
    requesterId: item.requesterId,
    requesterName: nameByRequesterId.get(item.requesterId) ?? 'Agent',
    clientId: item.clientId,
    clientName: nameByClientId.get(item.clientId) ?? 'Client',
    // Safe: only rows that already passed `isDecisionStatus` reach this
    // function (filtered in `fetchManagerApprovalFeed` below).
    status: item.status as ApprovalDecisionStatus,
    createdAt: item.createdAt,
    decidedAt: item.decidedAt,
  };

  if (item.requestKind === CLIENT_EDIT_REQUEST_KIND) {
    return { ...base, requestKind: 'client_edit', summary: toClientEditSummary(item.summary) };
  }
  return { ...base, requestKind: 'po_confirmation', summary: toPoConfirmationSummary(item.summary) };
}

/**
 * Manager Approvals inbox data source (Batch 6 PR B). Always the manager's
 * FULL team inbox — deliberately NOT scope-filtered by `managerScope`
 * ('mine'/'team'/'combined', PR C's concern) per ADR-052 section G: a
 * manager needs visibility of every pending decision regardless of the
 * Home/Meetings scope selection.
 */
export async function fetchManagerApprovalFeed(): Promise<ManagerApprovalFeedRow[]> {
  const items = await getManagerApprovalFeed();
  const inboxItems = items.filter((item) => isInboxKind(item.requestKind) && isDecisionStatus(item.status));

  const requesterIds = Array.from(new Set(inboxItems.map((item) => item.requesterId)));
  const clientIds = Array.from(new Set(inboxItems.map((item) => item.clientId)));

  const [nameByRequesterId, nameByClientId] = await Promise.all([
    fetchProfileNamesByIds(requesterIds),
    fetchClientNamesByIds(clientIds),
  ]);

  return inboxItems.map((item) => toFeedRow(item, nameByRequesterId, nameByClientId));
}
