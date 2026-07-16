import { getDb } from './db';
import { syncDown } from './sync-down';
import { checkConnectivity, type ConnectivityState } from './sync/connectivity';
import { isEntityTableName } from './sync/entity-registry';
import { recoverStuckSyncingRows, type OutboxStatus } from './sync/outbox-status';
import { pushDueOutboxRows, type OutboxRow, type OutboxSyncResult } from './sync/push-batch';

// T-002/T-005/T-014: pushes queued local writes (T-001's `outbox`) to
// Supabase, dispatching per-table behavior via the entity registry
// (lib/sync/entity-registry.ts) instead of hardcoded branches. Runs on
// reconnect + a 30s foreground-only drain timer (see use-sync.ts) — never
// assumes it's the only writer, since client-generated UUIDs make every
// upsert idempotent. Batching/classification live in lib/sync/push-batch.ts
// and lib/sync/outbox-status.ts, and the pull half in sync-down.ts (kept
// separate to respect the 300-line file limit).

async function processOutbox(agentId: string): Promise<OutboxSyncResult> {
  const db = await getDb();
  const now = new Date().toISOString();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT id, record_id, table_name, operation, payload, retry_count
     FROM outbox
     WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY priority ASC, created_at ASC`,
    [now]
  );
  return pushDueOutboxRows(db, rows, agentId);
}

/** Re-queues a dead-lettered ('failed') outbox row for a future manual-retry UI (not built in this pass). */
export async function retryFailedOutboxRow(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ record_id: string; table_name: string }>(
    "SELECT record_id, table_name FROM outbox WHERE id = ? AND status = 'failed'",
    [id]
  );
  if (!row) return;

  await db.runAsync(
    "UPDATE outbox SET status = 'pending', retry_count = 0, next_attempt_at = NULL, last_error = NULL WHERE id = ?",
    [id]
  );
  if (isEntityTableName(row.table_name)) {
    await db.runAsync(`UPDATE ${row.table_name} SET sync_status = 'pending', sync_error = NULL WHERE id = ?`, [
      row.record_id,
    ]);
  }
}

export interface SyncResult {
  synced: number;
  failed: number;
  connectivity: ConnectivityState;
}

let isSyncing = false;
// Runs once per app session — a row can only be orphaned by a kill that
// happened before this process started, so there's nothing to recover once
// this pass has already run.
let hasRecoveredStuckRows = false;

/**
 * Entry point for use-sync.ts. No-op if a sync is already running. Checks
 * connectivity BEFORE touching any outbox row — a network/auth problem is
 * not a per-record problem, so a failed/degraded connectivity check must
 * skip the push pass entirely rather than dead-lettering good records
 * (T-014, ADR-022 #3).
 */
export async function runSync(agentId: string): Promise<SyncResult | null> {
  if (isSyncing) return null;
  isSyncing = true;
  try {
    const db = await getDb();
    if (!hasRecoveredStuckRows) {
      await recoverStuckSyncingRows(db);
      hasRecoveredStuckRows = true;
    }

    const connectivity = await checkConnectivity();
    if (connectivity !== 'online') {
      return { synced: 0, failed: 0, connectivity };
    }

    const outboxResult = await processOutbox(agentId);
    await syncDown(agentId);
    return {
      synced: outboxResult.synced,
      failed: outboxResult.failed + outboxResult.conflicted,
      connectivity,
    };
  } finally {
    isSyncing = false;
  }
}

export interface OutboxCounts {
  pending: number;
  syncing: number;
  conflict: number;
  failed: number;
  synced: number;
}

/** T-005/T-014: lets a future UI (out of scope this pass) show pending/in-flight/conflict/failed/synced state. */
export async function getOutboxCounts(): Promise<OutboxCounts> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: OutboxStatus; count: number }>(
    'SELECT status, COUNT(*) as count FROM outbox GROUP BY status'
  );
  const counts: OutboxCounts = { pending: 0, syncing: 0, conflict: 0, failed: 0, synced: 0 };
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  return counts;
}

/** Back-compat single number for existing consumers (use-sync.ts) — pending only. */
export async function getPendingCount(): Promise<number> {
  const counts = await getOutboxCounts();
  return counts.pending;
}
