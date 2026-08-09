import { getDb } from './db';
import { supabase } from './supabase';
import { syncDown } from './sync-down';
import { checkConnectivity, type ConnectivityState } from './sync/connectivity';
import { isNetworkConnectivityError } from './network-error';
import { isEntityTableName } from './sync/entity-registry';
import { pruneSyncedOutboxRows, recoverStuckSyncingRows, type OutboxStatus } from './sync/outbox-status';
import { setLastSyncAt } from './sync/last-sync';
import { healStuckFieldRoleConflicts, pushDueOutboxRows, type OutboxRow, type OutboxSyncResult } from './sync/push-batch';
import { AUDIT_OUTBOX_TABLE_NAME } from './sync/audit-log';
import { processPendingUploads, recoverStuckPendingUploads } from './sync/photo-uploads';
import { reconcileAdditionalAcks } from './sync/additional-acks';
import { processCollectionPayments } from './sync/collection-payments';
import { processCodPayments } from './sync/cod-payments';
import { uploadPendingAvatar } from './profile-avatar';
import { retryFailedPendingUpload, type PendingUploadStatus } from './sync/pending-upload-status';
import { createCoalescingRunner } from './sync/coalescing-runner';

// T-002/T-005/T-014: pushes queued local writes (T-001's `outbox`) to
// Supabase, dispatching per-table behavior via the entity registry
// (lib/sync/entity-registry.ts) instead of hardcoded branches. Runs on
// login/reconnect/foreground/manual/post-write triggers plus an adaptive
// 30-60s(+backoff) foreground-only idle timer (Phase 1, 2026-08-04 — see
// use-sync.ts and lib/sync/adaptive-foreground-scheduler.ts) — never assumes
// it's the only writer, since client-generated UUIDs make every upsert
// idempotent. Batching/classification live in lib/sync/push-batch.ts and
// lib/sync/outbox-status.ts, and the pull half in sync-down.ts (kept
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
 *
 * B-059: also re-queues dead-lettered `pending_uploads` rows (photo
 * uploads) — `getOutboxCounts()` folds their 'failed' count into the same
 * total this button advertises ("Retry lahat (N)"), so the button must
 * actually retry all N, not just the `outbox` subset.
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
  const failedUploadIds = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM pending_uploads WHERE agent_id = ? AND status = 'failed'",
    [agentId]
  );
  for (const { id } of failedUploadIds) {
    await retryFailedPendingUpload(db, id);
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
    // B-087: a transient network/DNS drop here is expected under offline-first
    // (ADR-001) and already safe — the next runSync() pass retries. Only a
    // non-network failure (bad response shape, auth misconfig) is worth the
    // loud log; otherwise every flaky-connection blip paints a red LogBox
    // screen for a condition the app already handles correctly.
    if (!isNetworkConnectivityError(err)) {
      console.error('[sync-engine] syncPendingAvatarUpload failed', err);
    }
  }
}

// Runs once per app session — a row can only be orphaned by a kill that
// happened before this process started, so there's nothing to recover once
// this pass has already run.
let hasRecoveredStuckRows = false;

/**
 * Phase 1 adaptive sync scheduling (2026-08-04, Vince direction — see
 * projects/OracleSalesApp-Mobile/Sync-Scale-and-Realtime-Options-2026-08-04.md).
 * Replaces the old module-level `isSyncing` boolean, which silently DROPPED
 * any call that arrived while a pass was already running — losing that
 * caller's intent (a reconnect event, a write-service's fire-and-forget
 * post-write sync, the foreground timer, and the manual "Sync Now" button
 * all call `runSync()` directly and could race). Every external caller
 * still just calls `runSync(agentId, teamId)`; this coordinator is what
 * makes concurrent calls safe — see `lib/sync/coalescing-runner.ts`'s doc
 * comment for the exact single-flight + one-coalesced-follow-up semantics.
 */
const syncCoordinator = createCoalescingRunner<{ agentId: string; teamId?: string | null }, SyncResult>(
  ({ agentId, teamId }) => runSyncOnce(agentId, teamId)
);

/** Entry point for use-sync.ts, write-services' post-write syncs, and the manual "Sync Now" button — see `syncCoordinator` above for concurrency handling. */
export async function runSync(agentId: string, teamId?: string | null): Promise<SyncResult | null> {
  return syncCoordinator.run({ agentId, teamId });
}

/**
 * The actual push+pull pass. Checks connectivity BEFORE touching any outbox
 * row — a network/auth problem is not a per-record problem, so a failed/
 * degraded connectivity check must skip the push pass entirely rather than
 * dead-lettering good records (T-014, ADR-022 #3).
 */
async function runSyncOnce(agentId: string, teamId?: string | null): Promise<SyncResult> {
  const db = await getDb();
  if (!hasRecoveredStuckRows) {
    await recoverStuckSyncingRows(db);
    await recoverStuckPendingUploads(db);
    // F-007: retire any field-role day-list rows a pre-fix build left frozen in
    // 'conflict' (see healStuckFieldRoleConflicts). Best-effort — a heal failure
    // must never fail or delay the sync pass; the inline auto-resolve still
    // handles every conflict from here on.
    try {
      await healStuckFieldRoleConflicts(db, agentId);
    } catch (err) {
      console.error('healStuckFieldRoleConflicts failed', err);
    }
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
  // (enqueueMeetingPhotoUrlUpdate) to patch photo_url/end_photo_url — push
  // it immediately with one more processOutbox() pass instead of waiting
  // for the next idle tick. (That function also makes its own best-effort
  // `runSync()` call, guarded by `isSyncRunning()` — see
  // photo-upload-registry.ts — so it doesn't queue a redundant coalesced
  // rerun for a row this very pass's extra processOutbox() call already covers.)
  const uploadResult = await processPendingUploads(db, agentId);
  await syncPendingAvatarUpload();
  const photoPatchResult =
    uploadResult.synced > 0 ? await processOutbox(agentId) : { synced: 0, failed: 0, conflicted: 0 };
  // F-007 Partial payment (web 070): upload each queued payment's proof photos
  // then INSERT it (collector RLS is insert-only, so URLs ride in the insert).
  // Runs BEFORE syncDown so the server trigger's roll-up onto the visit
  // (amount_collected + partial/collected status) is pulled back this same pass.
  // Best-effort, like reconcileAdditionalAcks below: a failure in a payment lane
  // (e.g. a missing migration, a bad row) must NEVER abort the pass and starve
  // processOutbox's already-pushed rows or the syncDown that reads the server's
  // roll-up back. Each lane manages its own per-row retry; a thrown error here is
  // swallowed so the pass still completes.
  const paymentResult = await processCollectionPayments(db, agentId).catch((err: unknown) => {
    console.error('processCollectionPayments failed', err);
    return { synced: 0, failed: 0 };
  });
  // F-007 Delivery partial COD (web 073): same lane as collection payments —
  // upload each queued COD proof then INSERT it (driver RLS is insert-only). Runs
  // AFTER processOutbox (so a first-delivery's handover UPDATE has synced, which
  // its own `sync_status='synced'` guard requires) and BEFORE syncDown (so the
  // server trigger's cod_amount/partial roll-up is pulled back this same pass).
  const codPaymentResult = await processCodPayments(db, agentId).catch((err: unknown) => {
    console.error('processCodPayments failed', err);
    return { synced: 0, failed: 0 };
  });
  await syncDown(agentId, teamId);
  // F-007 Additional Collection (web 068/069): acknowledge additional stores
  // back to the server via the collector-only RPCs — received (just pulled) and
  // seen (collector opened it offline earlier). Best-effort: it manages its own
  // errors and must never fail the pass, so a throw here is swallowed.
  await reconcileAdditionalAcks(db).catch((err: unknown) => {
    console.error('reconcileAdditionalAcks failed', err);
  });
  // ADR-026 P2 item 6: stamped unconditionally once the pass gets this far
  // — even if some rows dead-lettered along the way (Vince confirmed: do
  // NOT gate on `failed === 0`). This naturally excludes the offline-
  // connectivity early-return above. A SecureStore failure must never fail
  // the sync pass or its return value.
  await setLastSyncAt(new Date().toISOString()).catch((err: unknown) => {
    console.error('setLastSyncAt failed', err);
  });
  return {
    synced: outboxResult.synced + photoPatchResult.synced + paymentResult.synced + codPaymentResult.synced,
    failed:
      outboxResult.failed +
      outboxResult.conflicted +
      uploadResult.failed +
      photoPatchResult.failed +
      photoPatchResult.conflicted +
      paymentResult.failed +
      codPaymentResult.failed,
    connectivity,
  };
}

/** Whether a sync pass (including any coalesced follow-up) is currently in flight — used by photo-upload-registry.ts to skip a guaranteed-redundant nested trigger, not a general-purpose "should I sync" check. */
export function isSyncRunning(): boolean {
  return syncCoordinator.isRunning;
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
