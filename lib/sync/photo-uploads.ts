import { File } from 'expo-file-system';
import { uuidv4 } from '../uuid';
import { classifySyncError, MAX_OUTBOX_ATTEMPTS } from './outbox-status';
import { markUploadRow, markUploadSynced, markUploadSyncing, scheduleUploadRetry } from './pending-upload-status';
import { enqueueSyncAuditRow } from './audit-log';
import { reportSyncProgressStep } from './sync-progress';
import {
  enqueuePhotoUrlUpdate,
  PHOTO_UPLOAD_KINDS,
  publicUrlFor,
  uploadPhotoToBucket,
  type PhotoKind,
  type PhotoParentTable,
} from './photo-upload-registry';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ClassifiedError } from './outbox-status';

// T-014 Phase C (ADR-026 P1 item 4) — generalized for F-007 Phase 2b
// (2026-07-29): processes the local-only `pending_uploads` queue (lib/db.ts
// schema v18). A confirmed photo that couldn't upload in the foreground sits
// here until this loop pushes it to Supabase Storage, then patches its parent
// row's remote photo column via `enqueuePhotoUrlUpdate()`. The queue is now
// cross-entity: each row names its `parent_table` (meetings | collection_visits
// | purchase_orders) and `kind`, and the photo-upload-registry maps that to the
// bucket + columns. Deliberately its OWN small processing loop, not routed
// through the entity-registry/outbox pipeline — a Storage upload isn't a row
// upsert, and the eventual remote patch already rides the parent's outbox lane.

export type { PhotoKind };

const FILE_MISSING_MESSAGE = 'Photo file no longer available on device';
const UNSUPPORTED_KIND_MESSAGE = 'Unsupported photo kind — no upload registry mapping';

export interface EnqueuePendingUploadInput {
  parentTable: PhotoParentTable;
  parentId: string;
  agentId: string;
  kind: PhotoKind;
  localUri: string;
  storagePath: string;
}

/** Inserts a `pending` row — called right after the parent row's own local insert/update + outbox row commit (see meeting-service.ts / collection-delivery-write.ts). */
export async function enqueuePendingUpload(db: SQLiteDatabase, input: EnqueuePendingUploadInput): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO pending_uploads (id, parent_table, parent_id, agent_id, kind, local_uri, storage_path, status, retry_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
    [uuidv4(), input.parentTable, input.parentId, input.agentId, input.kind, input.localUri, input.storagePath, now]
  );
}

interface PendingUploadRow {
  id: string;
  parent_table: PhotoParentTable;
  parent_id: string;
  agent_id: string;
  kind: string;
  local_uri: string;
  storage_path: string;
  retry_count: number;
}

/** Supabase Storage's "object already exists" response — the same outcome as a successful upload for our purposes, since `storage_path` is deterministic/reused across retries (see `buildPhotoStoragePath`). */
function isAlreadyExistsError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { status, statusCode, message } = err as { status?: number; statusCode?: string; message?: string };
  if (status === 409) return true;
  if (typeof statusCode === 'string' && /duplicate/i.test(statusCode)) return true;
  return typeof message === 'string' && /already exists/i.test(message);
}

async function enqueueUploadAudit(
  db: SQLiteDatabase,
  row: PendingUploadRow,
  outcome: 'synced' | 'failed',
  classified: ClassifiedError | null
): Promise<void> {
  await enqueueSyncAuditRow(db, {
    deviceOpId: row.id,
    userId: row.agent_id,
    entityTable: 'pending_uploads',
    entityId: row.parent_id,
    operation: 'upload',
    outcome,
    attemptCount: row.retry_count,
    errorCode: classified?.code ?? null,
    errorDetail: classified ? { message: classified.message, kind: classified.kind } : null,
  });
}

/** B-032 defense: verify the local file still exists before attempting the Storage call — a lost cache-directory file is a permanent, not retryable, failure. */
function fileStillExists(localUri: string): boolean {
  return new File(localUri).exists;
}

async function handleUploadFailure(
  db: SQLiteDatabase,
  row: PendingUploadRow,
  classified: ClassifiedError
): Promise<void> {
  if (classified.kind === 'transient') {
    const nextRetryCount = row.retry_count + 1;
    if (nextRetryCount < MAX_OUTBOX_ATTEMPTS) {
      await scheduleUploadRetry(db, row.id, nextRetryCount, classified);
      return;
    }
    await markUploadRow(
      db,
      row.id,
      'failed',
      `${classified.code ?? ''} ${classified.message}`.trim(),
      nextRetryCount,
      classified.failureClass
    );
    await enqueueUploadAudit(db, { ...row, retry_count: nextRetryCount }, 'failed', classified);
    return;
  }
  // 'conflict' has no meaningful distinct handling here (Storage upload
  // errors never carry Postgres's 23505 code) — treat the same as
  // 'permanent': immediately dead-lettered, no retry.
  await markUploadRow(
    db,
    row.id,
    'failed',
    `${classified.code ?? ''} ${classified.message}`.trim(),
    row.retry_count,
    classified.failureClass
  );
  await enqueueUploadAudit(db, row, 'failed', classified);
}

async function processOneRow(
  db: SQLiteDatabase,
  row: PendingUploadRow,
  parentSynced: boolean,
): Promise<'synced' | 'skipped' | 'failed'> {
  const config = PHOTO_UPLOAD_KINDS[row.kind as keyof typeof PHOTO_UPLOAD_KINDS];
  if (!config) {
    // Fail fast, before any Storage call or `synced` mark — never orphan a
    // real upload behind a row that can't ever patch its parent.
    await markUploadRow(db, row.id, 'failed', UNSUPPORTED_KIND_MESSAGE, row.retry_count, 'unknown');
    await enqueueUploadAudit(db, row, 'failed', {
      kind: 'permanent',
      failureClass: 'unknown',
      message: UNSUPPORTED_KIND_MESSAGE,
    });
    return 'failed';
  }

  // Skip (no retry penalty) until the parent row's remote row exists AND its
  // outcome/insert has synced — see computeSyncedParents() for why this is a
  // pass-start snapshot, not a live per-row re-check.
  if (!parentSynced) {
    return 'skipped';
  }

  if (!fileStillExists(row.local_uri)) {
    await markUploadRow(db, row.id, 'failed', FILE_MISSING_MESSAGE, row.retry_count, 'unknown');
    await enqueueUploadAudit(db, row, 'failed', {
      kind: 'permanent',
      failureClass: 'unknown',
      message: FILE_MISSING_MESSAGE,
    });
    return 'failed';
  }

  await markUploadSyncing(db, row.id);

  let publicUrl: string;
  try {
    publicUrl = await uploadPhotoToBucket(row.local_uri, row.storage_path, config.bucket);
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      publicUrl = publicUrlFor(config.bucket, row.storage_path);
    } else {
      await handleUploadFailure(db, row, classifySyncError(err));
      return 'failed';
    }
  }

  await markUploadSynced(db, row.id);
  await enqueuePhotoUrlUpdate(db, row.parent_table, row.parent_id, row.kind as keyof typeof PHOTO_UPLOAD_KINDS, publicUrl, row.agent_id);
  await enqueueUploadAudit(db, row, 'synced', null);
  return 'synced';
}

export interface PendingUploadSyncResult {
  synced: number;
  failed: number;
}

/**
 * Snapshots which parents are already synced, ONCE, before the upload loop runs.
 * Critical: `enqueuePhotoUrlUpdate` (called after each successful upload) flips
 * its parent's `sync_status` back to 'pending' to queue the URL patch. If the
 * guard re-read `sync_status` live per row, the first photo on a parent would
 * make every SIBLING photo on that same parent (e.g. a collection visit's
 * payment + delivery-receipt) look "blocked" and defer it to a later sync
 * cycle — the delivery-receipt-never-lands bug. The preceding processOutbox()
 * pass in runSync() already pushed each parent's outcome/insert, so this
 * snapshot reflects the true post-outcome state for the whole pass. Grouped by
 * table so it's one query per parent table, not one per row.
 */
async function computeSyncedParents(db: SQLiteDatabase, rows: PendingUploadRow[]): Promise<Set<string>> {
  const idsByTable = new Map<PhotoParentTable, Set<string>>();
  for (const row of rows) {
    const set = idsByTable.get(row.parent_table) ?? new Set<string>();
    set.add(row.parent_id);
    idsByTable.set(row.parent_table, set);
  }

  const synced = new Set<string>();
  for (const [table, ids] of idsByTable) {
    const idList = [...ids];
    const placeholders = idList.map(() => '?').join(',');
    // `table` is a controlled union value (the parent_table CHECK constraint),
    // never user input — safe to interpolate.
    const found = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM ${table} WHERE sync_status = 'synced' AND id IN (${placeholders})`,
      idList
    );
    for (const r of found) synced.add(`${table}:${r.id}`);
  }
  return synced;
}

/** Processes every due `pending` row (respecting `next_attempt_at`), FIFO by `created_at`. One bad row never blocks the rest. Called from sync-engine.ts::runSync() after processOutbox(). */
export async function processPendingUploads(db: SQLiteDatabase, agentId: string): Promise<PendingUploadSyncResult> {
  const now = new Date().toISOString();
  const rows = await db.getAllAsync<PendingUploadRow>(
    `SELECT id, parent_table, parent_id, agent_id, kind, local_uri, storage_path, retry_count
     FROM pending_uploads
     WHERE agent_id = ? AND status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY created_at ASC`,
    [agentId, now]
  );

  const syncedParents = await computeSyncedParents(db, rows);

  const result: PendingUploadSyncResult = { synced: 0, failed: 0 };
  for (const row of rows) {
    try {
      const parentSynced = syncedParents.has(`${row.parent_table}:${row.parent_id}`);
      const outcome = await processOneRow(db, row, parentSynced);
      // 'skipped' (parent not yet synced this pass) is deliberately NOT
      // terminal — see sync-progress.ts's doc comment for why it's excluded.
      if (outcome === 'synced') {
        result.synced++;
        reportSyncProgressStep();
      }
      if (outcome === 'failed') {
        result.failed++;
        reportSyncProgressStep();
      }
    } catch (err) {
      // Defensive: an unexpected throw (e.g. a malformed row) must never
      // stop the remaining rows from being attempted this pass.
      const classified = classifySyncError(err);
      await markUploadRow(
        db,
        row.id,
        'failed',
        `${classified.code ?? ''} ${classified.message}`.trim(),
        row.retry_count,
        classified.failureClass
      );
      await enqueueUploadAudit(db, row, 'failed', classified);
      result.failed++;
      reportSyncProgressStep();
    }
  }
  return result;
}

export { recoverStuckPendingUploads } from './pending-upload-status';
