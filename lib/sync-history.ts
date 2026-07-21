import { getDb } from './db';
import { AUDIT_OUTBOX_TABLE_NAME } from './sync/audit-log';
import { RLS_PERMISSION_DENIED_CODE } from './sync/outbox-status';
import type { FailureClass, OutboxStatus } from './sync/outbox-status';

// More > Sync History (Wireframe `id="a-synchistory"`, `aRenderSyncHistory()`):
// per-record terminal-outcome log. `sync_audit_log` (Sprint.md T-016) is a
// REMOTE-only table, drafted but not yet applied to Supabase (see
// lib/sync/audit-log.ts) — nothing to read from there yet. The `outbox`
// table itself is never pruned (no DELETE anywhere in lib/sync/), so it
// already holds a genuine local record of every synced/failed/conflict
// outcome — this reads THAT, not mock data, and excludes the internal
// `sync_audit` lane (audit rows about other rows, not user-facing history).

export type SyncHistoryOutcome = Exclude<OutboxStatus, 'pending' | 'syncing'>;

export interface SyncHistoryEntry {
  id: string;
  tableName: string;
  operation: string;
  status: SyncHistoryOutcome;
  createdAt: string;
  occurredAt: string;
  label: string;
  lastError: string | null;
  /** B-027: was the device online when this write was first queued? Null = row predates the column, unknown — never guessed. */
  createdOnline: boolean | null;
  /** Set only for `status === 'failed'` — points the agent at what to do next, since retrying repeatedly won't fix a genuinely broken record. */
  adminMessage: string | null;
}

interface OutboxHistoryRow {
  id: string;
  record_id: string;
  table_name: string;
  operation: string;
  payload: string;
  status: OutboxStatus;
  created_at: string;
  synced_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  retry_count: number;
  created_online: number | null;
  failure_class: FailureClass | null;
}

function labelFor(tableName: string, payload: string): string {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (tableName === 'clients' && typeof parsed.company_name === 'string') {
      return parsed.company_name;
    }
    if (tableName === 'meetings') {
      return 'Meeting record';
    }
  } catch {
    // Malformed/partial payload — fall through to the generic label.
  }
  return tableName === 'clients' ? 'Client record' : tableName;
}

function toCreatedOnline(value: number | null): boolean | null {
  return value === null ? null : value === 1;
}

/**
 * B-042: a permission/configuration-class error (Postgres `42501` — RLS
 * denial) can NEVER be fixed by retrying or by the agent correcting their
 * data — it means the system itself is misconfigured. Showing this
 * immediately (not gated on `retryCount > 0` like the generic message
 * below) is more honest than letting the agent tap Retry and wait, since no
 * amount of retrying changes a database permission error. Kept as the
 * FALLBACK check now that ADR-026 P2's `failure_class` column has shipped —
 * used only for pre-migration-9 rows where `failure_class` is still NULL
 * (see isPermissionDenied() below, the primary check).
 */
function isPermissionDeniedError(lastError: string | null): boolean {
  return lastError !== null && lastError.startsWith(RLS_PERMISSION_DENIED_CODE);
}

/** Primary check: `failure_class === 'authentication'` when the column is populated (migration 9+ rows); falls back to the string-sniff above only for NULL (pre-v9) rows. */
function isPermissionDenied(failureClass: FailureClass | null, lastError: string | null): boolean {
  if (failureClass !== null) return failureClass === 'authentication';
  return isPermissionDeniedError(lastError);
}

/**
 * B-027: a record stuck on 'failed' after retries has exhausted what the
 * app itself can do — tapping "Retry" again won't fix a genuinely broken
 * write (bad data, a removed client, a real backend problem). Points the
 * agent at the admin rather than leaving them to tap Retry forever.
 */
function adminMessageFor(
  status: OutboxStatus,
  retryCount: number,
  lastError: string | null,
  failureClass: FailureClass | null
): string | null {
  if (status === 'failed' && isPermissionDenied(failureClass, lastError)) {
    return 'Hindi maayos ng app na ito — may kailangang ayusin sa system settings. Kontakin agad ang admin/IT sa office, hindi na kailangang mag-retry pa.';
  }
  if (status === 'failed' && retryCount > 0) {
    return 'Paulit-ulit na nabigo — kontakin ang admin sa office kung magpapatuloy ito pagkatapos mag-retry.';
  }
  if (status === 'conflict') {
    return 'May kasalukuyang bersyon na sa server — kontakin ang admin sa office para malutas.';
  }
  return null;
}

/** Most-recent-first terminal outbox outcomes (synced/conflict/failed), capped for a device-local list view. */
export async function getSyncHistory(limit = 50): Promise<SyncHistoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OutboxHistoryRow>(
    `SELECT id, record_id, table_name, operation, payload, status, created_at, synced_at, last_attempt_at, last_error, retry_count, created_online, failure_class
     FROM outbox
     WHERE status IN ('synced', 'conflict', 'failed') AND table_name != ?
     ORDER BY COALESCE(last_attempt_at, synced_at, created_at) DESC
     LIMIT ?`,
    [AUDIT_OUTBOX_TABLE_NAME, limit]
  );
  return rows.map((row) => ({
    id: row.id,
    tableName: row.table_name,
    operation: row.operation,
    status: row.status as SyncHistoryOutcome,
    createdAt: row.created_at,
    occurredAt: row.last_attempt_at ?? row.synced_at ?? row.created_at,
    label: labelFor(row.table_name, row.payload),
    lastError: row.last_error,
    createdOnline: toCreatedOnline(row.created_online),
    adminMessage: adminMessageFor(row.status, row.retry_count, row.last_error, row.failure_class),
  }));
}

export interface PendingSyncEntry {
  id: string;
  tableName: string;
  status: OutboxStatus;
  label: string;
  createdAt: string;
  createdOnline: boolean | null;
  adminMessage: string | null;
}

/**
 * B-024: the Sync Center sheet only ever showed an aggregate count ("12
 * pending"), never WHICH records — so a client created offline was
 * genuinely invisible there beyond a number, even though it's sitting right
 * in the local `outbox` table the whole time. Reuses `labelFor()` so this
 * and Sync History render the same "Oracle Petroleum" / "Meeting record"
 * labels instead of a bare table name.
 */
export async function getPendingSyncEntries(limit = 20): Promise<PendingSyncEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OutboxHistoryRow>(
    `SELECT id, record_id, table_name, operation, payload, status, created_at, synced_at, last_attempt_at, last_error, retry_count, created_online, failure_class
     FROM outbox
     WHERE status IN ('pending', 'syncing', 'conflict', 'failed') AND table_name != ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [AUDIT_OUTBOX_TABLE_NAME, limit]
  );
  return rows.map((row) => ({
    id: row.id,
    tableName: row.table_name,
    status: row.status,
    label: labelFor(row.table_name, row.payload),
    createdAt: row.created_at,
    createdOnline: toCreatedOnline(row.created_online),
    adminMessage: adminMessageFor(row.status, row.retry_count, row.last_error, row.failure_class),
  }));
}
