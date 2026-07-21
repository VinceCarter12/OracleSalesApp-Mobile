import { getDb } from './db';
import { supabase } from './supabase';
import { syncDown } from './sync-down';
import { checkConnectivity, type ConnectivityState } from './sync/connectivity';
import { isEntityTableName } from './sync/entity-registry';
import { pruneSyncedOutboxRows, recoverStuckSyncingRows, type OutboxStatus } from './sync/outbox-status';
import { setLastSyncAt } from './sync/last-sync';
import { pushDueOutboxRows, type OutboxRow, type OutboxSyncResult } from './sync/push-batch';
import { AUDIT_OUTBOX_TABLE_NAME } from './sync/audit-log';
import { processPendingUploads, recoverStuckPendingUploads } from './sync/photo-uploads';
import { uploadPendingAvatar } from './profile-avatar';
import type { PendingUploadStatus } from './sync/pending-upload-status';

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

/** Re-queues a dead-lettered ('failed') outbox row for the manual-retry UI. */
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

/**
 * B-023: `retryFailedOutboxRow` existed since ADR-018 but had no UI ever
 * calling it — a dead-lettered ('failed') row is deliberately excluded from
 * `processOutbox()`'s auto-retry query (manual retry only, by design), but
 * nothing let an agent actually trigger that retry, so failed counts stayed
 * red forever even back online. Re-queues every currently-failed row, then
 * runs a normal sync pass to push them.
 */
export async function retryAllFailedOutboxRows(agentId: string): Promise<SyncResult | null> {
  const db = await getDb();
  // B-030: exclude the internal `sync_audit` lane — same reasoning as
  // getOutboxCounts() above, an agent's "Retry All" tap should only touch
  // their own business records, never internal bookkeeping rows.
  const failedIds = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM outbox WHERE status = 'failed' AND table_name != ?",
    [AUDIT_OUTBOX_TABLE_NAME]
  );
  for (const { id } of failedIds) {
    await retryFailedOutboxRow(id);
  }
  return runSync(agentId);
}

export interface SyncResult {
  synced: number;
  failed: number;
  connectivity: ConnectivityState;
}

/**
 * ADR-029: profile avatar uploads use their own lightweight SecureStore
 * queue keyed by Auth uid (`session.user.id`), not `agentId`/`profileId` —
 * the `avatars` bucket's Storage RLS and the `profiles` UPDATE policy both
 * predicate on `auth.uid()` (opposite convention from clients/meetings, see
 * ADR-023). Resolving the Auth uid here (rather than threading it through
 * `runSync()`'s signature) keeps the call site simple. Never throws —
 * `uploadPendingAvatar` already catches everything internally, and a failed
 * session lookup here must not fail the sync pass either.
 */
async function syncPendingAvatarUpload(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const authUid = data.session?.user.id;
    if (authUid) {
      await uploadPendingAvatar(authUid);
    }
  } catch (err) {
    console.error('[sync-engine] syncPendingAvatarUpload failed', err);
  }
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
export async function runSync(agentId: string, teamId?: string | null): Promise<SyncResult | null> {
  if (isSyncing) return null;
  isSyncing = true;
  try {
    const db = await getDb();
    if (!hasRecoveredStuckRows) {
      await recoverStuckSyncingRows(db);
      await recoverStuckPendingUploads(db);
      // ADR-026 P2 item 7: unlike the two recovery calls above (correctness-
      // critical — a real problem there should surface), a prune failure
      // must never fail or delay a sync pass, so it gets its own try/catch.
      try {
        await pruneSyncedOutboxRows(db);
      } catch (err) {
        console.error('pruneSyncedOutboxRows failed', err);
      }
      hasRecoveredStuckRows = true;
    }

    const connectivity = await checkConnectivity();
    if (connectivity !== 'online') {
      return { synced: 0, failed: 0, connectivity };
    }

    const outboxResult = await processOutbox(agentId);
    // T-014 Phase C (ADR-026 P1 item 4): queued photo uploads run after the
    // regular outbox pass (a photo's parent meeting must already be
    // 'synced' — see photo-uploads.ts's dependency guard). A row that just
    // reached 'synced' here enqueued a fresh `meetings` outbox UPDATE
    // (enqueueMeetingPhotoUrlUpdate) to patch photo_url/end_photo_url —
    // push it immediately with one more processOutbox() pass instead of
    // waiting for the next 30s foreground drain tick. (That function also
    // makes its own best-effort `runSync()` call, but it always no-ops here
    // since `isSyncing` is still held by this very call.)
    const uploadResult = await processPendingUploads(db, agentId);
    await syncPendingAvatarUpload();
    const photoPatchResult =
      uploadResult.synced > 0 ? await processOutbox(agentId) : { synced: 0, failed: 0, conflicted: 0 };
    await syncDown(agentId, teamId);
    // ADR-026 P2 item 6: stamped unconditionally once the pass gets this far
    // — even if some rows dead-lettered along the way (Vince confirmed: do
    // NOT gate on `failed === 0`). This naturally excludes the isSyncing
    // and offline-connectivity early-returns above, since both return
    // before reaching this point. A SecureStore failure must never fail the
    // sync pass or its return value.
    await setLastSyncAt(new Date().toISOString()).catch((err: unknown) => {
      console.error('setLastSyncAt failed', err);
    });
    return {
      synced: outboxResult.synced + photoPatchResult.synced,
      failed: outboxResult.failed + outboxResult.conflicted + uploadResult.failed + photoPatchResult.failed + photoPatchResult.conflicted,
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

/**
 * T-005/T-014: powers the Sync Center / My Meetings sync chip's
 * pending/in-flight/conflict/failed/synced counts.
 *
 * B-030: was counting EVERY outbox row regardless of `table_name` —
 * including `sync_audit` rows, the internal bookkeeping lane
 * (`lib/sync/audit-log.ts`) that logs the OUTCOME of other rows' syncs and
 * is never meant to be agent-visible. Because every real sync attempt
 * enqueues its own audit row, and the remote `sync_audit_log` table has a
 * `UNIQUE(device_op_id, outcome)` constraint that a retried audit push
 * re-violates, these accumulate as 'conflict' indefinitely — inflating the
 * Sync Center's counts with numbers that have nothing to do with the
 * agent's actual clients/meetings (a "24 conflict" banner that was 100%
 * internal noise). Excluded from this count now.
 *
 * T-014 Phase C (ADR-026 P1 item 4): also folds in `pending_uploads` rows —
 * a queued/failed photo is a real thing the agent is waiting on, so it must
 * be visible in the same Sync Center counts as any other pending/failed
 * write, even though it lives in its own table outside the outbox pipeline.
 */
export async function getOutboxCounts(): Promise<OutboxCounts> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: OutboxStatus; count: number }>(
    'SELECT status, COUNT(*) as count FROM outbox WHERE table_name != ? GROUP BY status',
    [AUDIT_OUTBOX_TABLE_NAME]
  );
  const uploadRows = await db.getAllAsync<{ status: PendingUploadStatus; count: number }>(
    'SELECT status, COUNT(*) as count FROM pending_uploads GROUP BY status'
  );
  const counts: OutboxCounts = { pending: 0, syncing: 0, conflict: 0, failed: 0, synced: 0 };
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  for (const row of uploadRows) {
    counts[row.status] += row.count;
  }
  return counts;
}

/** Back-compat single number for existing consumers (use-sync.ts) — pending only. */
export async function getPendingCount(): Promise<number> {
  const counts = await getOutboxCounts();
  return counts.pending;
}
