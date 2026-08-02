import { getDb } from './db';
import { uuidv4 } from './uuid';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import { isLikelyOnline } from './sync/connectivity';
import { verifyAccountActive, AccountSuspendedError } from './app-lock/account-status';
import { buildClientEditRequestRemotePayload, type ClientEditRequestChanges } from './client-edit-request-payload';

// ADR-052 (Batch 6 Phase 5): mirrors lib/client-service.ts::updateClientInfo()'s
// structure exactly — local-first write + outbox enqueue in one transaction,
// then a best-effort immediate sync. NO UI branch calls this yet (Phase 8's
// job, app/(tabs)/clients/complete.tsx's Branch 3) — this file is dead-but-
// safe infrastructure until then, same phased-rollout discipline as every
// other file in this pass.

const SENSITIVE_WRITE_CHECK_TIMEOUT_MS = 2500;

export type ClientEditRequestStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface ClientEditRequest {
  id: string;
  clientId: string;
  requestedBy: string;
  changes: ClientEditRequestChanges;
  status: ClientEditRequestStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  baseUpdatedAt: string;
  baseAssignedAgentId: string;
  createdAt: string;
  updatedAt: string;
}

/** Thrown when a client edit request is attempted for a client that hasn't synced down to this device yet — there's no local `base_updated_at`/`base_assigned_agent_id` to stamp the request with. */
export class ClientNotFoundLocallyError extends Error {
  constructor(clientId: string) {
    super(`Client ${clientId} not found in the local database`);
    this.name = 'ClientNotFoundLocallyError';
  }
}

interface LocalClientBaseRow {
  updated_at: string;
  agent_id: string;
}

/**
 * Local-first client-edit-request creation (ADR-052 section D): dup-check
 * against a second concurrent request is defense-in-depth only here
 * (`getPendingEditRequestForClient()` below is the UI's actual client-side
 * gate) — the server's partial unique index is the real authority. One
 * SQLite transaction for the `client_edit_requests` insert + its `outbox`
 * row, then a best-effort immediate sync.
 */
export async function createClientEditRequest(
  clientId: string,
  requesterId: string,
  changes: ClientEditRequestChanges
): Promise<string> {
  const accountStatus = await verifyAccountActive(requesterId, SENSITIVE_WRITE_CHECK_TIMEOUT_MS);
  if (accountStatus === 'suspended') {
    throw new AccountSuspendedError();
  }

  const db = await getDb();
  // `updated_at` is the LOCAL clients table's server-authoritative column —
  // NOT `local_updated_at` (see client-edit-request-payload.ts's doc comment
  // for why getting this backwards would cause a false base_conflict).
  // `agent_id` is the local column name for the remote `assigned_agent_id`.
  const clientRow = await db.getFirstAsync<LocalClientBaseRow>(
    'SELECT updated_at, agent_id FROM clients WHERE id = ?',
    [clientId]
  );
  if (!clientRow) {
    throw new ClientNotFoundLocallyError(clientId);
  }

  const id = uuidv4();
  const outboxId = uuidv4();
  const now = new Date().toISOString();
  const remotePayload = buildClientEditRequestRemotePayload({
    id,
    clientId,
    requestedBy: requesterId,
    changes,
    baseUpdatedAt: clientRow.updated_at,
    baseAssignedAgentId: clientRow.agent_id,
  });

  const createdOnline = await isLikelyOnline();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO client_edit_requests
        (id, client_id, requested_by, changes, base_updated_at, base_assigned_agent_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, clientId, requesterId, JSON.stringify(changes), clientRow.updated_at, clientRow.agent_id, now, now]
    );
    await enqueueOutboxRow(db, {
      outboxId,
      recordId: id,
      tableName: 'client_edit_requests',
      operation: 'insert',
      payload: JSON.stringify(remotePayload),
      createdAt: now,
      createdOnline,
    });
  });

  runSync(requesterId).catch((err) =>
    console.error('[client-edit-request-service] background sync failed:', JSON.stringify(err, null, 2))
  );

  return id;
}

interface LocalClientEditRequestRow {
  id: string;
  client_id: string;
  requested_by: string;
  changes: string;
  status: ClientEditRequestStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  base_updated_at: string;
  base_assigned_agent_id: string;
  created_at: string;
  updated_at: string;
}

function rowToClientEditRequest(row: LocalClientEditRequestRow): ClientEditRequest {
  return {
    id: row.id,
    clientId: row.client_id,
    requestedBy: row.requested_by,
    changes: JSON.parse(row.changes) as ClientEditRequestChanges,
    status: row.status,
    reviewNote: row.review_note,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    baseUpdatedAt: row.base_updated_at,
    baseAssignedAgentId: row.base_assigned_agent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Phase 8's UI reads this to show the pending banner and block a second
 * concurrent request client-side (defense-in-depth alongside the server's
 * partial unique index, ADR-052 section A). Most-recent pending request only
 * — there's at most one, by construction (the unique index + this check).
 */
export async function getPendingEditRequestForClient(clientId: string): Promise<ClientEditRequest | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<LocalClientEditRequestRow>(
    "SELECT * FROM client_edit_requests WHERE client_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    [clientId]
  );
  return row ? rowToClientEditRequest(row) : null;
}
