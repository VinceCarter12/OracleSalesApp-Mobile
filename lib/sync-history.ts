import { getDb } from './db';
import { AUDIT_OUTBOX_TABLE_NAME } from './sync/audit-log';
import type { OutboxStatus } from './sync/outbox-status';

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
  occurredAt: string;
  label: string;
  lastError: string | null;
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

/** Most-recent-first terminal outbox outcomes (synced/conflict/failed), capped for a device-local list view. */
export async function getSyncHistory(limit = 50): Promise<SyncHistoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OutboxHistoryRow>(
    `SELECT id, record_id, table_name, operation, payload, status, created_at, synced_at, last_attempt_at, last_error
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
    occurredAt: row.last_attempt_at ?? row.synced_at ?? row.created_at,
    label: labelFor(row.table_name, row.payload),
    lastError: row.last_error,
  }));
}
