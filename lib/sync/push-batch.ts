import { isBlockedByDependency, isEntityTableName } from './entity-registry';
import { enqueueSyncAuditRow, type AuditOutcome } from './audit-log';
import { getPushTarget, pushChunk, pushSingleRow, type PushTarget } from './remote-upsert';
import {
  classifySyncError,
  markOutboxRow,
  markOutboxSyncing,
  scheduleRetry,
  MAX_OUTBOX_ATTEMPTS,
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
  if (isEntityTableName(row.table_name)) {
    await db.runAsync(`UPDATE ${row.table_name} SET sync_status = 'synced', sync_error = NULL WHERE id = ?`, [
      row.record_id,
    ]);
  }
  await enqueueAuditForRow(db, row, 'synced', null, agentId);
}

async function handleRowFailure(
  db: SQLiteDatabase,
  row: OutboxRow,
  classified: ClassifiedError,
  result: OutboxSyncResult,
  agentId: string
): Promise<void> {
  if (classified.kind === 'conflict') {
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

async function markSyncingBatch(db: SQLiteDatabase, rows: OutboxRow[]): Promise<void> {
  for (const row of rows) {
    await markOutboxSyncing(db, row.id);
  }
}

async function pushGroup(
  db: SQLiteDatabase,
  rows: OutboxRow[],
  target: PushTarget,
  result: OutboxSyncResult,
  agentId: string
): Promise<void> {
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

async function failUnregisteredRows(db: SQLiteDatabase, rows: OutboxRow[], result: OutboxSyncResult): Promise<void> {
  const classified: ClassifiedError = {
    kind: 'permanent',
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
