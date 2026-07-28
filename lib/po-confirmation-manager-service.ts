import { supabase } from './supabase';
import { PO_CONFIRMATION_REQUEST_KIND } from './policies/po-confirmation-status-policy';
import type { RemoteApprovalRequestKind } from '../types/database';

// ADR-044 (Migration 042) + ADR-046 point 7 (Batch 3, Slice 5): Manager-side
// read/decide path for the unified approval feed. Split out of
// `lib/po-confirmation-service.ts` (that file's requester-side reads/writes)
// — same reasoning as `lib/tag-along-manager-service.ts` being split out of
// `lib/tag-along-service.ts`.
//
// ⚠️ NOT wired into any screen yet — a pre-implementation wireframe check
// (hard project rule) found that `Wireframe-Manager-BizLink.html`'s only
// `s-approvals` screen is scoped EXCLUSIVELY to client-edit requests (a
// still-deferred, not-yet-built domain per ADR-044 decision 3), and its
// client-detail "pending" banner only branches on `type==='edit'` or
// reassignment (no `po_confirmation`/tag-along branch anywhere). There is no
// wireframe screen for a Manager deciding a team member's PO confirmation or
// pending-manager-tag-along request today — flagged to Vince rather than
// inventing one. This file exists so the RPC contract is ready the moment
// that screen is designed; every function here is pure I/O, safe to unit-test
// against a mocked `supabase` client, and imports nothing UI-specific.

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
