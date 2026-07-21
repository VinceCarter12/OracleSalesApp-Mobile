import { backoffDelayMs } from './outbox-status';
import type { ClassifiedError, FailureClass } from './outbox-status';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-014 Phase C (ADR-026 P1 item 4): state-transition helpers for the
// local-only `pending_uploads` queue (lib/db.ts schema v8). Deliberately a
// sibling of lib/sync/outbox-status.ts rather than a parameterized version
// of it — `pending_uploads` is never routed through the entity-registry/
// outbox pipeline (lib/sync/photo-uploads.ts owns its own processing loop),
// so sharing a table name parameter across both would blur that boundary.
// The row shapes and transition semantics intentionally mirror
// outbox-status.ts so the two are easy to read side by side.

export type PendingUploadStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

/** Set BEFORE calling Supabase Storage, so a killed app leaves a `syncing` row for recoverStuckPendingUploads() to find on next launch. */
export async function markUploadSyncing(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("UPDATE pending_uploads SET status = 'syncing' WHERE id = ?", [id]);
}

/** Terminal (non-retry) status transition — mirrors markOutboxRow(), minus the source-table sync_status side effect (pending_uploads has no mirrored remote table of its own). */
export async function markUploadRow(
  db: SQLiteDatabase,
  id: string,
  status: PendingUploadStatus,
  errorText: string | null,
  retryCount: number,
  failureClass: FailureClass | null = null
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE pending_uploads SET status = ?, last_error = ?, last_attempt_at = ?, retry_count = ?, failure_class = ? WHERE id = ?',
    [status, errorText, now, retryCount, failureClass, id]
  );
}

/** Marks a row synced after the Storage object is confirmed to exist (upload success or a 409 "already exists"). */
export async function markUploadSynced(db: SQLiteDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    "UPDATE pending_uploads SET status = 'synced', synced_at = ?, last_error = NULL, last_attempt_at = ? WHERE id = ?",
    [now, now, id]
  );
}

/** Resets a transiently-failed row back to 'pending' with a jittered next_attempt_at — mirrors scheduleRetry() in outbox-status.ts. */
export async function scheduleUploadRetry(
  db: SQLiteDatabase,
  id: string,
  retryCount: number,
  classified: ClassifiedError
): Promise<void> {
  const now = new Date().toISOString();
  const nextAttemptAt = new Date(Date.now() + backoffDelayMs(retryCount)).toISOString();
  const errorText = `${classified.code ?? ''} ${classified.message}`.trim();
  await db.runAsync(
    `UPDATE pending_uploads SET status = 'pending', retry_count = ?, last_error = ?, last_attempt_at = ?, next_attempt_at = ?, failure_class = ?
     WHERE id = ?`,
    [retryCount, errorText, now, nextAttemptAt, classified.failureClass, id]
  );
}

/** A row stuck in 'syncing' with no live pipeline running is orphaned (the app was killed mid-upload) — mirrors recoverStuckSyncingRows(). Safe to reset: storage_path is deterministic/reused, so a resumed upload can never duplicate the object. */
export async function recoverStuckPendingUploads(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("UPDATE pending_uploads SET status = 'pending' WHERE status = 'syncing'");
}
