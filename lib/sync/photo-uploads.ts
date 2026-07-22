import { File } from 'expo-file-system';
import { supabase } from '../supabase';
import { uuidv4 } from '../uuid';
import { classifySyncError, MAX_OUTBOX_ATTEMPTS } from './outbox-status';
import { markUploadRow, markUploadSynced, markUploadSyncing, scheduleUploadRetry } from './pending-upload-status';
import { enqueueSyncAuditRow } from './audit-log';
import {
  enqueueMeetingPhotoUrlUpdate,
  MEETING_PHOTO_BUCKET,
  PHOTO_KIND_TO_REMOTE_COLUMN,
  uploadMeetingPhoto,
} from '../meeting-photo-service';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ClassifiedError } from './outbox-status';

// T-014 Phase C (ADR-026 P1 item 4): processes the local-only
// `pending_uploads` queue (lib/db.ts schema v8) — a confirmed meeting photo
// that couldn't upload in the foreground (ADR-026 P1's interim fix) sits
// here until this loop successfully pushes it to Supabase Storage, then
// patches its parent meeting's remote photo column via
// `enqueueMeetingPhotoUrlUpdate()`. Deliberately its OWN small processing
// loop, not routed through the entity-registry/outbox pipeline in
// lib/sync/push-batch.ts — a Storage upload isn't a row upsert, and the
// eventual remote patch already rides the existing `meetings` outbox lane.

export type PhotoKind = 'selfie' | 'start' | 'end';

const FILE_MISSING_MESSAGE = 'Photo file no longer available on device';

export interface EnqueuePendingUploadInput {
  meetingId: string;
  agentId: string;
  kind: PhotoKind;
  localUri: string;
  storagePath: string;
}

/** Inserts a `pending` row — called from lib/meeting-service.ts::createMeeting() right after the parent meeting's own local insert + outbox row commit. */
export async function enqueuePendingUpload(db: SQLiteDatabase, input: EnqueuePendingUploadInput): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO pending_uploads (id, meeting_id, agent_id, kind, local_uri, storage_path, status, retry_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
    [uuidv4(), input.meetingId, input.agentId, input.kind, input.localUri, input.storagePath, now]
  );
}

interface PendingUploadRow {
  id: string;
  meeting_id: string;
  agent_id: string;
  kind: PhotoKind;
  local_uri: string;
  storage_path: string;
  retry_count: number;
}

/** Supabase Storage's "object already exists" response — the same outcome as a successful upload for our purposes, since `storage_path` is deterministic/reused across retries (see `buildMeetingPhotoStoragePath`). */
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
    entityId: row.meeting_id,
    operation: 'upload',
    outcome,
    attemptCount: row.retry_count,
    errorCode: classified?.code ?? null,
    errorDetail: classified ? { message: classified.message, kind: classified.kind } : null,
  });
}

/** Dependency guard mirroring lib/sync/entity-registry.ts::isBlockedByDependency — skips WITHOUT penalizing retry_count/next_attempt_at until the parent meeting itself has synced. */
async function isBlockedByUnsyncedMeeting(db: SQLiteDatabase, meetingId: string): Promise<boolean> {
  const meeting = await db.getFirstAsync<{ sync_status: string }>(
    'SELECT sync_status FROM meetings WHERE id = ?',
    [meetingId]
  );
  return meeting === null || meeting.sync_status !== 'synced';
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

const UNSUPPORTED_KIND_MESSAGE = 'Unsupported photo kind — no remote column mapping';

async function processOneRow(db: SQLiteDatabase, row: PendingUploadRow): Promise<'synced' | 'skipped' | 'failed'> {
  if (!PHOTO_KIND_TO_REMOTE_COLUMN[row.kind]) {
    // Fail fast, before any Storage call or `synced` mark — never orphan a
    // real upload behind a row that can't ever patch its parent meeting.
    await markUploadRow(db, row.id, 'failed', UNSUPPORTED_KIND_MESSAGE, row.retry_count, 'unknown');
    await enqueueUploadAudit(db, row, 'failed', {
      kind: 'permanent',
      failureClass: 'unknown',
      message: UNSUPPORTED_KIND_MESSAGE,
    });
    return 'failed';
  }

  if (await isBlockedByUnsyncedMeeting(db, row.meeting_id)) {
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
    publicUrl = await uploadMeetingPhoto(row.local_uri, row.storage_path);
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      publicUrl = supabase.storage.from(MEETING_PHOTO_BUCKET).getPublicUrl(row.storage_path).data.publicUrl;
    } else {
      await handleUploadFailure(db, row, classifySyncError(err));
      return 'failed';
    }
  }

  await markUploadSynced(db, row.id);
  await enqueueMeetingPhotoUrlUpdate(db, row.meeting_id, row.kind, publicUrl, row.agent_id);
  await enqueueUploadAudit(db, row, 'synced', null);
  return 'synced';
}

export interface PendingUploadSyncResult {
  synced: number;
  failed: number;
}

/** Processes every due `pending` row (respecting `next_attempt_at`), FIFO by `created_at`. One bad row never blocks the rest. Called from sync-engine.ts::runSync() after processOutbox(). */
export async function processPendingUploads(db: SQLiteDatabase, agentId: string): Promise<PendingUploadSyncResult> {
  const now = new Date().toISOString();
  const rows = await db.getAllAsync<PendingUploadRow>(
    `SELECT id, meeting_id, agent_id, kind, local_uri, storage_path, retry_count
     FROM pending_uploads
     WHERE agent_id = ? AND status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY created_at ASC`,
    [agentId, now]
  );

  const result: PendingUploadSyncResult = { synced: 0, failed: 0 };
  for (const row of rows) {
    try {
      const outcome = await processOneRow(db, row);
      if (outcome === 'synced') result.synced++;
      if (outcome === 'failed') result.failed++;
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
    }
  }
  return result;
}

export { recoverStuckPendingUploads } from './pending-upload-status';
