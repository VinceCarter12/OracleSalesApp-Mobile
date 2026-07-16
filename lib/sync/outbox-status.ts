import { isEntityTableName } from './entity-registry';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-002/T-005/T-014: outbox row state transitions — split out of
// sync-engine.ts so lib/sync/push-batch.ts can share it without growing
// sync-engine.ts past the 300-line limit.

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

// Exponential backoff capped at 15s: 1s, 2s, 4s, 8s, 15s, 15s, ...
export const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000, 15000];
export const MAX_OUTBOX_ATTEMPTS = 10;
export const UNIQUE_VIOLATION_CODE = '23505';
const JITTER_RATIO = 0.2;

export interface ClassifiedError {
  kind: 'conflict' | 'transient' | 'permanent';
  code?: string;
  message: string;
}

/** Supabase's PostgrestError is a plain object, not an `Error` instance — `instanceof Error` misses it and `String(err)` degrades to `"[object Object]"`, losing the actual message. Check for a string `.message` property directly instead. */
function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}

/** 23505 (Postgres unique violation) is a real duplicate, never auto-retried; timeouts/network/5xx retry with backoff; anything else fails immediately (bad payload, RLS denial, etc). */
export function classifySyncError(err: unknown): ClassifiedError {
  const message = extractMessage(err);
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : undefined;

  if (code === UNIQUE_VIOLATION_CODE) return { kind: 'conflict', code, message };

  const isTransient = /timed out|network|fetch failed|ECONNRESET|ETIMEDOUT|5\d\d/i.test(message);
  return { kind: isTransient ? 'transient' : 'permanent', code, message };
}

/**
 * ±20% jitter on top of the fixed backoff schedule (T-014, ADR-022 #13) —
 * prevents many devices that lost connectivity together (e.g. a shared
 * outage) from all retrying in perfect lockstep once it recovers.
 */
export function backoffDelayMs(attempt: number): number {
  const index = Math.min(attempt - 1, BACKOFF_SCHEDULE_MS.length - 1);
  const base = BACKOFF_SCHEDULE_MS[index];
  const jitterFactor = 1 - JITTER_RATIO + Math.random() * (2 * JITTER_RATIO);
  return Math.round(base * jitterFactor);
}

/** Set BEFORE calling Supabase, so a killed app leaves a `syncing` row (never confused with a never-attempted `pending` one) for recoverStuckSyncingRows() to find on next launch. */
export async function markOutboxSyncing(db: SQLiteDatabase, outboxId: string): Promise<void> {
  await db.runAsync("UPDATE outbox SET status = 'syncing' WHERE id = ?", [outboxId]);
}

/** Updates the outbox row and — for business entities only, sync_audit rows have no mirrored local table — the source table's sync_status. */
export async function markOutboxRow(
  db: SQLiteDatabase,
  outboxId: string,
  recordId: string,
  tableName: string,
  status: OutboxStatus,
  classified: ClassifiedError,
  retryCount: number
): Promise<void> {
  const now = new Date().toISOString();
  const errorText = `${classified.code ?? ''} ${classified.message}`.trim();
  await db.runAsync(
    'UPDATE outbox SET status = ?, last_error = ?, last_attempt_at = ?, retry_count = ? WHERE id = ?',
    [status, errorText, now, retryCount, outboxId]
  );
  if (isEntityTableName(tableName)) {
    await db.runAsync(`UPDATE ${tableName} SET sync_status = ?, sync_error = ? WHERE id = ?`, [
      status,
      classified.message,
      recordId,
    ]);
  }
}

/** Resets a transiently-failed row back to 'pending' with a jittered next_attempt_at — status must be reset explicitly now, since it may currently be 'syncing'. */
export async function scheduleRetry(
  db: SQLiteDatabase,
  outboxId: string,
  retryCount: number,
  classified: ClassifiedError
): Promise<void> {
  const now = new Date().toISOString();
  const nextAttemptAt = new Date(Date.now() + backoffDelayMs(retryCount)).toISOString();
  const errorText = `${classified.code ?? ''} ${classified.message}`.trim();
  await db.runAsync(
    `UPDATE outbox SET status = 'pending', retry_count = ?, last_error = ?, last_attempt_at = ?, next_attempt_at = ?
     WHERE id = ?`,
    [retryCount, errorText, now, nextAttemptAt, outboxId]
  );
}

/**
 * A row stuck in 'syncing' with no live pipeline running is orphaned (the
 * app was killed mid-push). Resetting it to 'pending' is always safe: every
 * upsert uses a client-generated UUID with onConflict:'id' (or, for audit
 * rows, the device_op_id+outcome composite), so a resumed push can never
 * double-create a record.
 */
export async function recoverStuckSyncingRows(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("UPDATE outbox SET status = 'pending' WHERE status = 'syncing'");
}
