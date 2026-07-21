import { File } from 'expo-file-system';
import { supabase } from './supabase';
import { uuidv4 } from './uuid';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import { isLikelyOnline } from './sync/connectivity';
import { withTimeout } from './with-timeout';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { PhotoKind } from './sync/photo-uploads';

// T-014 Phase C (ADR-026 P1 item 4): split out of lib/meeting-service.ts
// (300-line file limit) — everything specific to a meeting PHOTO's own
// storage lifecycle (path convention, the raw Storage upload, and the
// remote-column patch once it's confirmed uploaded) lives here. Meeting
// CRUD itself (createMeeting, the field-name/value mapping to Supabase)
// stays in meeting-service.ts.

/** Same bucket/timeout used by lib/sync/photo-uploads.ts's queued retries — single source of truth. */
export const MEETING_PHOTO_BUCKET = 'meeting-photos';
// Larger payload than a row upsert (SYNC_TIMEOUT_MS=15000 in sync/remote-upsert.ts)
// — a 1-3MB compressed photo (ADR-008) needs more room on a degraded link before
// ADR-026 P1's offline fallback in the calling screen can kick in.
export const PHOTO_UPLOAD_TIMEOUT_MS = 30000;

/**
 * Deterministic storage path, built once (by the recording screen, right
 * after `createMeeting()` returns the new meeting id) and reused on every
 * retry — required for Phase C's "409 already exists = success" idempotency
 * guarantee. Camera capture is JPEG-only (ImagePicker's default output,
 * confirmed via components/meetings/PhotoCapture.tsx's `launchCameraAsync`
 * call, which sets no other format), so the extension is always `.jpg`
 * rather than re-derived from the local URI on every attempt.
 */
export function buildMeetingPhotoStoragePath(userId: string, meetingId: string, kind: PhotoKind): string {
  return `meetings/${userId}/${meetingId}-${kind}.jpg`;
}

/**
 * Uploads a locally captured photo to Supabase Storage and returns its public
 * URL. Reads the file's raw bytes via SDK 57's `File.bytes()` rather than
 * `fetch(uri).then(r => r.blob())` — on Hermes/Android, supabase-storage-js
 * re-reads a RN `Blob` via `FileReader.readAsArrayBuffer` and then tries to
 * construct `new Blob([arrayBuffer])` internally, which RN's Blob polyfill
 * doesn't support ("Creating blobs from 'ArrayBuffer' ... are not
 * supported") — passing bytes directly skips that path entirely.
 *
 * NOTE: `expo-file-system/legacy` (the `readAsStringAsync` API) looked right
 * at first, but its package.json `exports` map points at un-transpiled `.ts`
 * source that Metro can't resolve as an installed dependency (only works
 * inside the expo/expo monorepo itself) — it crashed the bundler entirely.
 * `File` is the real, documented SDK 57 API and needs no subpath import.
 *
 * Phase C (ADR-026 P1 item 4): `storagePath` is passed in rather than
 * generated per-call — it must be the SAME path across every retry of the
 * same photo (see `buildMeetingPhotoStoragePath()`), so a retried upload
 * after a partial success can treat Storage's 409 "already exists" response
 * as a success instead of a new failure. Only called from
 * lib/sync/photo-uploads.ts now — the recording screens no longer upload in
 * the foreground (Phase C queues every photo instead).
 */
export async function uploadMeetingPhoto(localUri: string, storagePath: string): Promise<string> {
  const bytes = await new File(localUri).bytes();
  // A stalled/degraded connection doesn't reject on its own — it hangs the
  // upload indefinitely, which left the caller's try/catch fallback
  // (ADR-026 P1) unreachable and the agent stuck on a spinner. Race against
  // a timeout so a bad connection always surfaces as a catchable error.
  const { error } = await withTimeout(
    supabase.storage.from(MEETING_PHOTO_BUCKET).upload(storagePath, bytes, { contentType: 'image/jpeg' }),
    PHOTO_UPLOAD_TIMEOUT_MS,
    `meeting photo upload (${storagePath})`
  );
  if (error) throw error;
  const { data } = supabase.storage.from(MEETING_PHOTO_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Exported so callers (lib/sync/photo-uploads.ts) can reject an unsupported
 * `kind` BEFORE attempting an upload or marking a queue row `synced` — the
 * `pending_uploads.kind` CHECK constraint still allows `'start'` for future
 * schema headroom (ADR-028), but no screen produces it today, and
 * `enqueueMeetingPhotoUrlUpdate` throwing on it AFTER a successful upload
 * would orphan a real Storage object with a permanently dead-lettered row
 * (found in review, 2026-07-19 — the row's own `WHERE status='pending'`
 * re-select never picks up a `failed` row again).
 */
export const PHOTO_KIND_TO_REMOTE_COLUMN: Partial<Record<PhotoKind, 'photo_url' | 'end_photo_url'>> = {
  selfie: 'photo_url',
  end: 'end_photo_url',
};

/**
 * Patches a meeting's remote photo column once its queued upload
 * (lib/sync/photo-uploads.ts) has confirmed the object exists in Storage.
 * Mirrors `lib/client-service.ts::updateClientInfo()`'s partial-update
 * pattern exactly: one local transaction (column update + outbox enqueue),
 * then a best-effort immediate sync — rides the ALREADY-EXISTING `meetings`
 * entity-registry entry, no new registry/dispatch code needed.
 */
export async function enqueueMeetingPhotoUrlUpdate(
  db: SQLiteDatabase,
  meetingId: string,
  kind: PhotoKind,
  publicUrl: string,
  agentId: string
): Promise<void> {
  const remoteColumn = PHOTO_KIND_TO_REMOTE_COLUMN[kind];
  if (!remoteColumn) {
    throw new Error(`enqueueMeetingPhotoUrlUpdate: unsupported photo kind "${kind}"`);
  }
  const localColumn = kind === 'selfie' ? 'selfie_url' : 'end_photo_url';
  const outboxId = uuidv4();
  const now = new Date().toISOString();
  const remotePayload = { id: meetingId, [remoteColumn]: publicUrl };
  const createdOnline = await isLikelyOnline();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE meetings SET ${localColumn} = ?, sync_status = 'pending', local_updated_at = ? WHERE id = ?`,
      [publicUrl, now, meetingId]
    );
    await enqueueOutboxRow(db, {
      outboxId,
      recordId: meetingId,
      tableName: 'meetings',
      operation: 'update',
      payload: JSON.stringify(remotePayload),
      createdAt: now,
      createdOnline,
    });
  });

  await runSync(agentId).catch((err) => {
    console.error('[meeting-photo-service] photo-url patch sync failed:', err instanceof Error ? err.message : String(err));
  });
}
