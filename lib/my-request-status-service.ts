import { getDb } from './db';
import { supabase } from './supabase';
import type { RemoteApprovalRequestKind } from '../types/database';
import type { ClientEditRequestChanges } from './client-edit-request-payload';

// Batch 8 (2026-08-02): Sales/RSR requester-side READ-ONLY mirror of
// `get_my_request_statuses()` — Wireframe-Sales-BizLink.html `a-myrequests`/
// `a-myrequestdetail` (`aRenderMyRequests()`/`aOpenMyRequest()`, ~line
// 1181-1217): "View-only status. Manager decision ang server-authoritative."
// Deliberately its own module, not added to `lib/tag-along-invitee-service.ts`
// (Manager/inviter side) or `lib/po-confirmation-service.ts` (requester-side
// PO drafts + reconciliation, which owns a LOCAL table this feature does
// not have) — every row here comes straight from the RPC, no local mirror,
// matching the wireframe comment directly above its `aMyRequestStatuses`
// fixture ("Every row is scoped to the signed-in requester; client names are
// resolved from the local client mirror"). Migration 056 (per
// Wireframe-Gap-Audit-2026-07-29.md "RPC evidence") already extends this RPC
// with the `client_edit` branch alongside Migration 042's PO-confirmation and
// tag-along branches, so `types/database.ts`'s existing
// `get_my_request_statuses` RPC type is used as-is here — no new RPC type
// was needed.

export type MyRequestStatus = 'pending' | 'approved' | 'rejected' | 'accepted' | 'declined' | 'cancelled';

export interface ClientEditMyRequestSummary {
  changes: ClientEditRequestChanges;
  fieldCount: number;
  reviewNote: string | null;
}

export interface PoConfirmationMyRequestSummary {
  poPhotoPath: string;
}

export interface TagAlongMyRequestSummary {
  inviteeKind: 'manager' | 'teammate';
}

interface MyRequestRowBase {
  id: string;
  clientId: string;
  clientName: string;
  status: MyRequestStatus;
  createdAt: string;
  decidedAt: string | null;
}

export type MyRequestRow =
  | (MyRequestRowBase & { requestKind: 'po_confirmation'; summary: PoConfirmationMyRequestSummary })
  | (MyRequestRowBase & { requestKind: 'client_edit'; summary: ClientEditMyRequestSummary })
  | (MyRequestRowBase & { requestKind: 'tag_along'; summary: TagAlongMyRequestSummary });

interface RemoteMyRequestRow {
  request_kind: RemoteApprovalRequestKind;
  request_id: string;
  client_id: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  summary: Record<string, unknown>;
}

interface RemoteClientEditSummary {
  changes?: ClientEditRequestChanges;
  field_count?: number;
  review_note?: string | null;
}

interface RemotePoConfirmationSummary {
  po_photo_path?: string;
}

interface RemoteTagAlongSummary {
  invitee_kind?: 'manager' | 'teammate';
}

interface LocalClientNameRow {
  id: string;
  company_name: string;
}

async function fetchLocalClientNames(clientIds: readonly string[]): Promise<Map<string, string>> {
  if (clientIds.length === 0) return new Map();
  const db = await getDb();
  const placeholders = clientIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<LocalClientNameRow>(
    `SELECT id, company_name FROM clients WHERE id IN (${placeholders})`,
    [...clientIds]
  );
  return new Map(rows.map((row) => [row.id, row.company_name]));
}

function toRow(row: RemoteMyRequestRow, nameByClientId: Map<string, string>): MyRequestRow {
  const base: MyRequestRowBase = {
    id: row.request_id,
    clientId: row.client_id,
    // Matches the wireframe's `aRequestClientName()` fallback ("Client record")
    // for a client the requester can no longer read locally.
    clientName: nameByClientId.get(row.client_id) ?? 'Client record',
    status: row.status as MyRequestStatus,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };

  if (row.request_kind === 'client_edit') {
    const raw = row.summary as RemoteClientEditSummary;
    const changes = raw.changes ?? {};
    return {
      ...base,
      requestKind: 'client_edit',
      summary: { changes, fieldCount: raw.field_count ?? Object.keys(changes).length, reviewNote: raw.review_note ?? null },
    };
  }

  if (row.request_kind === 'po_confirmation') {
    const raw = row.summary as RemotePoConfirmationSummary;
    return { ...base, requestKind: 'po_confirmation', summary: { poPhotoPath: raw.po_photo_path ?? '' } };
  }

  const raw = row.summary as RemoteTagAlongSummary;
  return { ...base, requestKind: 'tag_along', summary: { inviteeKind: raw.invitee_kind ?? 'manager' } };
}

/**
 * `get_my_request_statuses()` (Migration-042-Report.md lines 54-71, extended
 * by Migration 056) — SECURITY INVOKER, scoped to `requester_id =
 * current_profile_id()`. Online-only read (no local table to fall back to);
 * a network failure surfaces as a thrown error for the caller's hook to
 * catch, same as `fetchManagerApprovalFeed()`.
 */
export async function fetchMyRequestStatuses(): Promise<MyRequestRow[]> {
  const { data, error } = await supabase.rpc('get_my_request_statuses');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RemoteMyRequestRow[];

  const clientIds = Array.from(new Set(rows.map((row) => row.client_id)));
  const nameByClientId = await fetchLocalClientNames(clientIds);

  return rows
    .map((row) => toRow(row, nameByClientId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
