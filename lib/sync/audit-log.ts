import * as SecureStore from 'expo-secure-store';
import { uuidv4 } from '../uuid';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-014 (ADR-022 #11): permanent, admin-visible sync history — distinct
// from the local device's 7-day-pruned outbox view (Phase B). Delivered
// through the SAME outbox pipeline as business writes (offline-safe,
// retried like anything else) but as its own independent queue lane at a
// high priority number, so it never jumps ahead of real business data. The
// remote table (`sync_audit_log`) is drafted, not yet applied — see
// projects/OracleSalesApp-Mobile/Migration-015-Report.md.

export const AUDIT_OUTBOX_TABLE_NAME = 'sync_audit';
export const AUDIT_REMOTE_TABLE = 'sync_audit_log';
export const AUDIT_PRIORITY = 900;

const DEVICE_ID_KEY = 'oracle_sales_device_id';

export type AuditOperation = 'insert' | 'update' | 'delete' | 'upload';
export type AuditOutcome =
  | 'synced'
  | 'failed'
  | 'conflict'
  | 'conflict_resolved_rename'
  | 'conflict_resolved_adopt_server'
  | 'lww_overwrite_applied';

export interface AuditRowInput {
  deviceOpId: string;
  userId: string;
  entityTable: string;
  entityId: string;
  operation: AuditOperation;
  outcome: AuditOutcome;
  attemptCount: number;
  errorCode?: string | null;
  errorDetail?: Record<string, unknown> | null;
}

/** Stable per-install device identifier, generated once and persisted in SecureStore (same adapter pattern as lib/supabase.ts's session storage). */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = uuidv4();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

/**
 * Enqueues one audit row for a terminal/notable outbox transition (entering
 * synced/failed/conflict) — never for individual retry attempts, since
 * `attempt_count` already covers that. Goes through the same `outbox` table
 * as business writes so it's offline-safe and retried on failure, but at
 * AUDIT_PRIORITY (900) so it's always pushed last.
 */
export async function enqueueSyncAuditRow(db: SQLiteDatabase, input: AuditRowInput): Promise<void> {
  const deviceId = await getDeviceId();
  const now = new Date().toISOString();
  const payload = {
    device_op_id: input.deviceOpId,
    user_id: input.userId,
    device_id: deviceId,
    entity_table: input.entityTable,
    entity_id: input.entityId,
    operation: input.operation,
    outcome: input.outcome,
    attempt_count: input.attemptCount,
    error_code: input.errorCode ?? null,
    error_detail: input.errorDetail ?? null,
    occurred_at: now,
  };
  await db.runAsync(
    `INSERT INTO outbox (id, record_id, table_name, operation, payload, created_at, status, priority)
     VALUES (?, ?, ?, 'insert', ?, ?, 'pending', ?)`,
    [uuidv4(), input.entityId, AUDIT_OUTBOX_TABLE_NAME, JSON.stringify(payload), now, AUDIT_PRIORITY]
  );
}
