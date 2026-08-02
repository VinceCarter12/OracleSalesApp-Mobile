import { supabase } from './supabase';
import { PO_CONFIRMATION_REQUEST_KIND } from './policies/po-confirmation-status-policy';
import type { RemoteApprovalRequestKind } from '../types/database';

// ADR-044 (Migration 042) + ADR-046 point 7 (Batch 3, Slice 5): Manager-side
// read/decide path for the unified approval feed. Split out of
// `lib/po-confirmation-service.ts` (that file's requester-side reads/writes)
// — same reasoning as `lib/tag-along-manager-service.ts` being split out of
// `lib/tag-along-service.ts`.
//
// Correction (ADR-052 section J item 1, Batch 6 PR B, 2026-08-02): this
// header previously claimed the Manager Approvals screen was scoped
// EXCLUSIVELY to client-edit requests and that no wireframe screen existed
// for a Manager deciding a PO confirmation. That was already wrong when
// written — `Wireframe-Manager-BizLink.html`'s `s-approvals`/`openApproval()`
// always branched on 4 request types (`edit`/`po_confirmation`/`reassign`/
// `tagalong`), PO confirmation included (see `approvalTypeBadge()`/
// `approvalTypeLabel()`, ~line 1677). The real screen (Batch 6 PR B) now
// lives at `app/(manager)/approvals/`, built on
// `lib/manager-approval-feed-service.ts::fetchManagerApprovalFeed()`, which
// reuses `getManagerApprovalFeed()` below (still the single RPC call site)
// rather than duplicating it, and narrows its result to the `client_edit`/
// `po_confirmation` kinds that screen owns — `tag_along` keeps its own
// dedicated flow (`app/(manager)/tag-along.tsx`), unchanged by this batch.
// Every function here remains pure I/O, safe to unit-test against a mocked
// `supabase` client, and imports nothing UI-specific.

export interface ManagerApprovalFeedItem {
  requestKind: RemoteApprovalRequestKind;
  requestId: string;
  requesterId: string;
  clientId: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  /** `po_confirmation`: { po_photo_path, meeting_id }. `tag_along`: { invitee_kind, context }. Narrow by `requestKind` at the call site (Migration-042-Report.md lines 40-49). */
  summary: Record<string, unknown>;
}

interface RemoteFeedRow {
  request_kind: RemoteApprovalRequestKind;
  request_id: string;
  requester_id: string;
  client_id: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  summary: Record<string, unknown>;
}

function toFeedItem(row: RemoteFeedRow): ManagerApprovalFeedItem {
  return {
    requestKind: row.request_kind,
    requestId: row.request_id,
    requesterId: row.requester_id,
    clientId: row.client_id,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    summary: row.summary,
  };
}

/** `get_manager_approval_feed()` (Migration-042-Report.md lines 33-52) — SECURITY INVOKER, so RLS on `po_confirmation_requests`/`tag_along_requests` already scopes this to the caller's own team. Online-only (ADR-044 decision 5), no local mirror. */
export async function getManagerApprovalFeed(): Promise<ManagerApprovalFeedItem[]> {
  const { data, error } = await supabase.rpc('get_manager_approval_feed');
  if (error) throw error;
  return ((data ?? []) as RemoteFeedRow[]).map(toFeedItem);
}

/** Convenience filter for a PO-confirmation-only view (e.g. a future Manager Approvals screen's PO card list). */
export function filterPoConfirmationItems(items: readonly ManagerApprovalFeedItem[]): ManagerApprovalFeedItem[] {
  return items.filter((item) => item.requestKind === PO_CONFIRMATION_REQUEST_KIND);
}

export type PoConfirmationDecisionCode =
  | 'invalid_decision'
  | 'not_found'
  | 'role_not_eligible'
  | 'already_decided'
  | 'approved'
  | 'rejected';

/**
 * `decide_po_confirmation()` (Migration-039-Report.md lines 81-113) —
 * idempotent CAS: the first valid terminal decision wins, a later attempt on
 * an already-decided request returns `'already_decided'` (not an error, safe
 * to retry/double-tap). Rejection is server-enforced to keep the client
 * In Progress (Migration 040) — this function only relays the RPC result,
 * never assumes an outcome on the client.
 */
export async function decidePoConfirmation(
  requestId: string,
  decision: 'approved' | 'rejected',
  note?: string | null
): Promise<PoConfirmationDecisionCode> {
  const { data, error } = await supabase.rpc('decide_po_confirmation', {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data.code as PoConfirmationDecisionCode;
}
