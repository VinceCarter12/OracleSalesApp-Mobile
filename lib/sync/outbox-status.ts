import { isEntityTableName } from './entity-registry';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-002/T-005/T-014: outbox row state transitions — split out of
// sync-engine.ts so lib/sync/push-batch.ts can share it without growing
// sync-engine.ts past the 300-line limit.

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

// ADR-052 (Batch 6 Phase 5): the one entity whose outbox table_name isn't
// `clients`/`meetings`/etc's generic `sync_status`/`sync_error` shape — its
// own local-only terminal `status='superseded'` value IS the failure
// signal, so `markOutboxRow()` below special-cases it instead of running
// the generic per-table update (which would try to write a `sync_status`
// column this table doesn't have).
const CLIENT_EDIT_REQUESTS_TABLE = 'client_edit_requests';

// Exponential backoff capped at 15s: 1s, 2s, 4s, 8s, 15s, 15s, ...
export const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000, 15000];
export const MAX_OUTBOX_ATTEMPTS = 10;
export const UNIQUE_VIOLATION_CODE = '23505';
export const RLS_PERMISSION_DENIED_CODE = '42501';
const JITTER_RATIO = 0.2;

// ADR-026 P2 item 5: diagnostic-only classification of WHY a row failed —
// deliberately a separate axis from `kind` below. `kind` decides whether/how
// the sync engine retries a row; `failureClass` decides what message the
// agent/admin sees (lib/sync-history.ts). Never let one drive the other.
//
// 'rate_limited' added per ADR-036 (Batch 3): paired with the SQLite v13
// migration in lib/db.ts that widens the `failure_class` CHECK constraint on
// `outbox`/`pending_uploads` in the SAME change — see lib/contracts/rate-limit.ts.
export type FailureClass =
  | 'validation'
  | 'network'
  | 'authentication'
  | 'conflict'
  | 'server'
  | 'rate_limited'
  | 'unknown';

export interface ClassifiedError {
  kind: 'conflict' | 'transient' | 'permanent';
  failureClass: FailureClass;
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

const JWT_ERROR_PATTERN = /jwt expired|invalid jwt/i;
const DATA_EXCEPTION_CODE_PREFIXES = ['23', '22'];
const SERVER_ERROR_PATTERN = /5\d\d/;
const NETWORK_ERROR_PATTERN = /timed out|network|fetch failed|ECONNRESET|ETIMEDOUT/i;

// ADR-036: PostgREST/Kong's HTTP 429 ("Too Many Requests"). remote-upsert.ts
// attaches the response `status` onto the thrown error (see its
// `{ ...error, status }` at the pushSingleRow/pushChunk call sites) so this
// is a reliable status-code check, not a fragile message-text match — 429
// error bodies from Supabase's gateway don't consistently carry any
// particular text or Postgres error code.
export const RATE_LIMIT_STATUS_CODE = 429;

function extractStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && typeof (err as { status?: unknown }).status === 'number') {
    return (err as { status: number }).status;
  }
  return undefined;
}

/**
 * ADR-052 decision 4 (Batch 6 Phase 5): a `client_edit_requests` push that
 * fails with 403 (RLS rejection — e.g. the client was reassigned/lost mid-
 * request) or 23505 (unique violation — a duplicate pending request already
 * exists for this client) must NOT retry forever; it's a genuine, permanent
 * "this exact request can never succeed" outcome, not a transient hiccup.
 * Gated on the Postgres error `code` specifically (not the broader
 * `failureClass`/`kind` axes) so a JWT-expiry 'authentication' failure —
 * which IS worth retrying after reauth — is never misclassified the same way.
 */
export function isNonRetryableClientEditRequestFailure(classified: ClassifiedError): boolean {
  return classified.code === UNIQUE_VIOLATION_CODE || classified.code === RLS_PERMISSION_DENIED_CODE;
}

/**
 * ADR-026 P2 item 5: computes `failureClass`, a diagnostic classification
 * evaluated in a fixed priority order (5xx before the general network
 * pattern, since both are "server-side" symptoms but classify differently).
 * This is purely additive — it never changes `kind`/retry behavior below.
 */
function classifyFailureClass(code: string | undefined, message: string, status: number | undefined): FailureClass {
  if (code === UNIQUE_VIOLATION_CODE) return 'conflict';
  if (code === RLS_PERMISSION_DENIED_CODE) return 'authentication';
  if (JWT_ERROR_PATTERN.test(message)) return 'authentication';
  if (code !== undefined && DATA_EXCEPTION_CODE_PREFIXES.some((prefix) => code.startsWith(prefix))) {
    return 'validation';
  }
  if (status === RATE_LIMIT_STATUS_CODE) return 'rate_limited';
  if (SERVER_ERROR_PATTERN.test(message)) return 'server';
  if (NETWORK_ERROR_PATTERN.test(message)) return 'network';
  return 'unknown';
}

/** 23505 (Postgres unique violation) is a real duplicate, never auto-retried; timeouts/network/5xx/429 retry with backoff; anything else fails immediately (bad payload, RLS denial, etc). */
export function classifySyncError(err: unknown): ClassifiedError {
  const message = extractMessage(err);
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : undefined;
  const status = extractStatus(err);

  const failureClass = classifyFailureClass(code, message, status);

  if (code === UNIQUE_VIOLATION_CODE) return { kind: 'conflict', failureClass, code, message };

  // `kind`'s retry-decision logic is UNCHANGED from before failureClass
  // existed — deliberately kept as its own regex (plus the 429 status check)
  // so this axis never drifts from `classifyFailureClass()`'s more granular
  // breakdown above. ADR-036 3(b): rate-limited reuses the SAME exponential
  // backoff as 'server' (capped 15s, ADR-022) — no Retry-After-aware backoff
  // yet, that's a separate, not-yet-approved change.
  const isTransient =
    status === RATE_LIMIT_STATUS_CODE || /timed out|network|fetch failed|ECONNRESET|ETIMEDOUT|5\d\d/i.test(message);
  return { kind: isTransient ? 'transient' : 'permanent', failureClass, code, message };
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
    'UPDATE outbox SET status = ?, last_error = ?, last_attempt_at = ?, retry_count = ?, failure_class = ? WHERE id = ?',
    [status, errorText, now, retryCount, classified.failureClass, outboxId]
  );
  if (tableName === CLIENT_EDIT_REQUESTS_TABLE) {
    if (isNonRetryableClientEditRequestFailure(classified)) {
      await db.runAsync(
        "UPDATE client_edit_requests SET status = 'superseded', updated_at = ? WHERE id = ? AND status = 'pending'",
        [now, recordId]
      );
    }
    return;
  }
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
    `UPDATE outbox SET status = 'pending', retry_count = ?, last_error = ?, last_attempt_at = ?, next_attempt_at = ?, failure_class = ?
     WHERE id = ?`,
    [retryCount, errorText, now, nextAttemptAt, classified.failureClass, outboxId]
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

// ADR-026 P2 item 7: the local `outbox` table is never pruned otherwise (see
// lib/sync-history.ts's header comment) — a device that's been in use for
// months would otherwise accumulate an unbounded number of terminal 'synced'
// rows. Only ever deletes rows already confirmed synced; pending/syncing/
// conflict/failed rows are untouched regardless of age.
export const OUTBOX_PRUNE_RETENTION_DAYS = 7;

export async function pruneSyncedOutboxRows(db: SQLiteDatabase): Promise<void> {
  const cutoff = new Date(Date.now() - OUTBOX_PRUNE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.runAsync(
    "DELETE FROM outbox WHERE status = 'synced' AND synced_at IS NOT NULL AND synced_at < ?",
    [cutoff]
  );
}
