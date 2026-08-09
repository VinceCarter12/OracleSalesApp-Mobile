import { isBlockedByDependency, isEntityTableName, tableHasSyncStatusColumn } from './entity-registry';
import { isServerOwnedFieldRoleConflict } from './field-role-conflict';
import { enqueueSyncAuditRow, AUDIT_OUTBOX_TABLE_NAME, type AuditOutcome } from './audit-log';
import { getPushTarget, pushChunk, pushSingleRow, type PushTarget } from './remote-upsert';
import {
  classifySyncError,
  markOutboxRow,
  markOutboxSyncing,
  scheduleRetry,
  MAX_OUTBOX_ATTEMPTS,
  UNIQUE_VIOLATION_CODE,
  type ClassifiedError,
} from './outbox-status';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { OutboxRow } from './outbox-row';

// T-002/T-005/T-014: pushes due outbox rows to Supabase. Split out of
// sync-engine.ts (300-line file limit) — this is where batching (ADR-022
// #13), per-table dispatch via the entity registry, and audit-log
// enqueueing on terminal transitions all live. The actual Supabase
// `.upsert()` calls live in ./remote-upsert.ts (its own split, since
// supabase-js's typing forces a per-table branch there).

export const BATCH_THRESHOLD = 25;

export type { OutboxRow };

export interface OutboxSyncResult {
  synced: number;
  conflicted: number;
  failed: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function groupByTable(rows: OutboxRow[]): Array<[string, OutboxRow[]]> {
  const map = new Map<string, OutboxRow[]>();
  for (const row of rows) {
    const list = map.get(row.table_name) ?? [];
    list.push(row);
    map.set(row.table_name, list);
  }
  return [...map.entries()];
}

/** Never audits the sync_audit lane itself — only business-entity transitions are admin-visible history. */
async function enqueueAuditForRow(
  db: SQLiteDatabase,
  row: OutboxRow,
  outcome: AuditOutcome,
  classified: ClassifiedError | null,
  agentId: string
): Promise<void> {
  if (!isEntityTableName(row.table_name)) return;
  await enqueueSyncAuditRow(db, {
    deviceOpId: row.id,
    userId: agentId,
    entityTable: row.table_name,
    entityId: row.record_id,
    operation: row.operation,
    outcome,
    attemptCount: row.retry_count,
    errorCode: classified?.code ?? null,
    errorDetail: classified ? { message: classified.message, kind: classified.kind } : null,
  });
}

async function recordSynced(db: SQLiteDatabase, row: OutboxRow, agentId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync("UPDATE outbox SET status = 'synced', synced_at = ? WHERE id = ?", [now, row.id]);
  // Not every registered entity carries the generic sync_status/sync_error
  // mirror columns — client_edit_requests doesn't (see entity-registry.ts's
  // `hasSyncStatusColumn` doc comment); writing this UPDATE unconditionally
  // threw "no such column: sync_status" there, surfacing as an
  // ERR_INTERNAL_SQLITE_ERROR from the caller's fire-and-forget background sync.
  if (isEntityTableName(row.table_name) && tableHasSyncStatusColumn(row.table_name)) {
    await db.runAsync(`UPDATE ${row.table_name} SET sync_status = 'synced', sync_error = NULL WHERE id = ?`, [
      row.record_id,
    ]);
  }
  await enqueueAuditForRow(db, row, 'synced', null, agentId);
}

/**
 * F-007 (web 070/069/046): server-wins resolution for a field-role day-list
 * conflict on server-owned columns (see ./field-role-conflict.ts). The server
 * copy legitimately moved ahead by design (payment roll-up trigger / additional-
 * ack RPC / admin claim release), so the phone's stale edit must be DROPPED, not
 * frozen for admin review. The outbox row is retired terminally as 'synced'
 * (prunable, and never surfaces the "kontakin ang admin" conflict copy), and the
 * local mirror row is flipped back to 'synced' so THIS pass's syncDown() — which
 * runs right after the push — overwrites it with the authoritative server row
 * (its `WHERE sync_status='synced'` guard requires exactly that). The audit lane
 * still records the honest `conflict_resolved_adopt_server` outcome for history.
 */
async function resolveConflictServerWins(
  db: SQLiteDatabase,
  row: OutboxRow,
  classified: ClassifiedError,
  result: OutboxSyncResult,
  agentId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync("UPDATE outbox SET status = 'synced', synced_at = ?, last_error = NULL WHERE id = ?", [
    now,
    row.id,
  ]);
  // Same sync_status-column guard as recordSynced() above — this path is
  // only reachable for the field-role tables (collection_visits/
  // purchase_orders), which do have the column, but gate on the registry
  // rather than assume that stays true forever.
  if (isEntityTableName(row.table_name) && tableHasSyncStatusColumn(row.table_name)) {
    await db.runAsync(`UPDATE ${row.table_name} SET sync_status = 'synced', sync_error = NULL WHERE id = ?`, [
      row.record_id,
    ]);
  }
  await enqueueAuditForRow(db, row, 'conflict_resolved_adopt_server', classified, agentId);
  result.synced++;
}

async function handleRowFailure(
  db: SQLiteDatabase,
  row: OutboxRow,
  classified: ClassifiedError,
  result: OutboxSyncResult,
  agentId: string
): Promise<void> {
  if (classified.kind === 'conflict') {
    // B-030: a duplicate-key conflict on the `sync_audit` lane itself just
    // means this exact fact was already recorded by an earlier attempt —
    // benign, not a real conflict needing admin review (unlike an actual
    // client/meeting conflict). Marking it 'synced' instead stops these
    // from accumulating forever in the agent-visible outbox counts.
    if (row.table_name === AUDIT_OUTBOX_TABLE_NAME) {
      await recordSynced(db, row, agentId);
      result.synced++;
      return;
    }
    // F-007 (web 070/069/046): a unique-violation conflict on a Collection &
    // Delivery day-list UPDATE that touches ONLY server-owned columns is an
    // EXPECTED "the server already moved on" divergence (payment roll-up
    // trigger / additional-ack RPC / admin claim release), not a real edit
    // collision. Resolve it server-wins — drop the stale local edit — instead
    // of freezing the record and telling the field officer to phone the office.
    if (isServerOwnedFieldRoleConflict(row.table_name, row.payload)) {
      await resolveConflictServerWins(db, row, classified, result, agentId);
      return;
    }
    await markOutboxRow(db, row.id, row.record_id, row.table_name, 'conflict', classified, row.retry_count);
    await enqueueAuditForRow(db, row, 'conflict', classified, agentId);
    result.conflicted++;
    return;
  }
  if (classified.kind === 'transient') {
    const nextRetryCount = row.retry_count + 1;
    if (nextRetryCount < MAX_OUTBOX_ATTEMPTS) {
      await scheduleRetry(db, row.id, nextRetryCount, classified);
      return;
    }
    await markOutboxRow(db, row.id, row.record_id, row.table_name, 'failed', classified, nextRetryCount);
    await enqueueAuditForRow(db, { ...row, retry_count: nextRetryCount }, 'failed', classified, agentId);
    result.failed++;
    return;
  }
  await markOutboxRow(db, row.id, row.record_id, row.table_name, 'failed', classified, row.retry_count);
  await enqueueAuditForRow(db, row, 'failed', classified, agentId);
  result.failed++;
}

async function pushAndClassifyRow(
  db: SQLiteDatabase,
  row: OutboxRow,
  target: PushTarget,
  result: OutboxSyncResult,
  agentId: string
): Promise<void> {
  try {
    await pushSingleRow(row, target);
  } catch (err) {
    await handleRowFailure(db, row, classifySyncError(err), result, agentId);
    return;
  }
  // Remote upsert already succeeded — a failure here is local bookkeeping
  // only (e.g. SQLite busy), never a reason to retry/dead-letter a row
  // that's already durably synced server-side. Let it throw: the next
  // pass's idempotent upsert (client UUID + onConflict) will simply
  // re-confirm 'synced' rather than misclassify this as a push failure.
  await recordSynced(db, row, agentId);
  result.synced++;
}

/**
 * F-007: heals field-role day-list rows left FROZEN in 'conflict' by a build
 * that predates the inline server-wins auto-resolution above — e.g. the claim
 * that unique-violated (`collection_visits_one_active_claim`) before this
 * shipped, or a legacy pre-070 collect UPDATE. Such a row is the same expected
 * "server already moved on" divergence, never a real collision, so it must NOT
 * keep telling the field officer to "kontakin ang admin". Adopts the server row
 * (drops the stale local edit) and retires the outbox row, exactly like a fresh
 * conflict would now resolve. Run ONCE per session from runSyncOnce()'s recovery
 * block — the set of stuck rows is fixed at launch; new ones self-resolve inline.
 * Returns how many rows it healed.
 */
export async function healStuckFieldRoleConflicts(db: SQLiteDatabase, agentId: string): Promise<number> {
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT id, record_id, table_name, operation, payload, retry_count
     FROM outbox
     WHERE status = 'conflict' AND table_name IN ('collection_visits', 'purchase_orders')`
  );
  const classified: ClassifiedError = {
    kind: 'conflict',
    failureClass: 'conflict',
    code: UNIQUE_VIOLATION_CODE,
    message: 'server-wins: adopted the server row for a stuck field-role conflict',
  };
  let healed = 0;
  for (const row of rows) {
    if (!isServerOwnedFieldRoleConflict(row.table_name, row.payload)) continue;
    // Throwaway per-row result — this path reports its own count, not the
    // OutboxSyncResult the live push pass accumulates.
    await resolveConflictServerWins(db, row, classified, { synced: 0, conflicted: 0, failed: 0 }, agentId);
    healed++;
  }
  return healed;
}

async function markSyncingBatch(db: SQLiteDatabase, rows: OutboxRow[]): Promise<void> {
  for (const row of rows) {
    await markOutboxSyncing(db, row.id);
  }
}

/**
 * `.update()` only ever targets one row, unlike `.upsert()`'s multi-row
 * insert-shaped semantics — so 'update' rows always go through the
 * single-row path one at a time, regardless of BATCH_THRESHOLD. 'insert'
 * rows keep the existing chunk/pushChunk/fallback-to-individual behavior.
 */
async function pushInsertRows(
  db: SQLiteDatabase,
  rows: OutboxRow[],
  target: PushTarget,
  result: OutboxSyncResult,
  agentId: string
): Promise<void> {
  if (rows.length === 0) return;
  const chunks = rows.length > BATCH_THRESHOLD ? chunk(rows, BATCH_THRESHOLD) : [rows];
  for (const rowsChunk of chunks) {
    await markSyncingBatch(db, rowsChunk);
    if (rowsChunk.length === 1) {
      await pushAndClassifyRow(db, rowsChunk[0], target, result, agentId);
      continue;
    }
    try {
      await pushChunk(rowsChunk, target);
      for (const row of rowsChunk) {
        await recordSynced(db, row, agentId);
        result.synced++;
      }
    } catch {
      // Chunk-level failure loses per-row error attribution — fall back to
      // pushing this chunk's rows individually so a single bad row can't
      // fail all 25 without being identified.
      for (const row of rowsChunk) {
        await pushAndClassifyRow(db, row, target, result, agentId);
      }
    }
  }
}

async function pushUpdateRows(
  db: SQLiteDatabase,
  rows: OutboxRow[],
  target: PushTarget,
  result: OutboxSyncResult,
  agentId: string
): Promise<void> {
  if (rows.length === 0) return;
  await markSyncingBatch(db, rows);
  for (const row of rows) {
    await pushAndClassifyRow(db, row, target, result, agentId);
  }
}

async function pushGroup(
  db: SQLiteDatabase,
  rows: OutboxRow[],
  target: PushTarget,
  result: OutboxSyncResult,
  agentId: string
): Promise<void> {
  const insertRows = rows.filter((row) => row.operation === 'insert');
  const updateRows = rows.filter((row) => row.operation === 'update');
  await pushInsertRows(db, insertRows, target, result, agentId);
  await pushUpdateRows(db, updateRows, target, result, agentId);
}

async function failUnregisteredRows(db: SQLiteDatabase, rows: OutboxRow[], result: OutboxSyncResult): Promise<void> {
  const classified: ClassifiedError = {
    kind: 'permanent',
    failureClass: 'unknown',
    message: 'Unregistered outbox table_name — no entity-registry entry found',
  };
  for (const row of rows) {
    await markOutboxRow(db, row.id, row.record_id, row.table_name, 'failed', classified, row.retry_count);
    result.failed++;
  }
}

/** Pushes every due outbox row to Supabase, grouped by table (priority + created_at order preserved from the caller's query). One bad row never blocks the rest. */
export async function pushDueOutboxRows(
  db: SQLiteDatabase,
  rows: OutboxRow[],
  agentId: string
): Promise<OutboxSyncResult> {
  const result: OutboxSyncResult = { synced: 0, conflicted: 0, failed: 0 };
  const pushableRows: OutboxRow[] = [];

  for (const row of rows) {
    if (isEntityTableName(row.table_name) && (await isBlockedByDependency(db, row.table_name, row.payload))) {
      continue;
    }
    pushableRows.push(row);
  }

  for (const [tableName, groupRows] of groupByTable(pushableRows)) {
    const target = getPushTarget(tableName);
    if (!target) {
      await failUnregisteredRows(db, groupRows, result);
      continue;
    }
    await pushGroup(db, groupRows, target, result, agentId);
  }

  return result;
}
