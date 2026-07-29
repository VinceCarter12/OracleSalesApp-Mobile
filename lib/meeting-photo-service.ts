import {
  buildPhotoStoragePath,
  enqueuePhotoUrlUpdate,
  uploadPhotoToBucket,
  PHOTO_UPLOAD_TIMEOUT_MS,
} from './sync/photo-upload-registry';
import type { PhotoKind } from './sync/photo-uploads';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-014 Phase C (ADR-026 P1 item 4): the meeting PHOTO lifecycle. As of F-007
// Phase 2b (2026-07-29) the generic mechanics — bucketed upload, deterministic
// storage path, and the post-upload remote-column patch — moved to
// lib/sync/photo-upload-registry.ts so collection & delivery proofs can share
// the exact same lane. This file is now the thin, meeting-named facade over
// that registry: it fixes the parent table to 'meetings' and keeps the public
// names (buildMeetingPhotoStoragePath / uploadMeetingPhoto /
// enqueueMeetingPhotoUrlUpdate / MEETING_PHOTO_BUCKET) its existing callers and
// meeting-service.ts's re-exports already depend on.

/** Single source of truth for the meeting bucket, still re-exported via meeting-service.ts. */
export const MEETING_PHOTO_BUCKET = 'meeting-photos';

export { PHOTO_UPLOAD_TIMEOUT_MS };

/** Meeting-scoped storage path — delegates to the registry's builder with the 'meetings' parent, preserving the exact `meetings/${userId}/${meetingId}-${kind}.jpg` convention. */
export function buildMeetingPhotoStoragePath(userId: string, meetingId: string, kind: PhotoKind): string {
  return buildPhotoStoragePath('meetings', userId, meetingId, kind);
}

/** Uploads a meeting photo to the meeting bucket and returns its public URL. */
export async function uploadMeetingPhoto(localUri: string, storagePath: string): Promise<string> {
  return uploadPhotoToBucket(localUri, storagePath, MEETING_PHOTO_BUCKET);
}

/** Patches a meeting's remote photo column after its queued upload confirms the object exists — delegates to the registry with the 'meetings' parent. */
export async function enqueueMeetingPhotoUrlUpdate(
  db: SQLiteDatabase,
  meetingId: string,
  kind: PhotoKind,
  publicUrl: string,
  agentId: string,
): Promise<void> {
  return enqueuePhotoUrlUpdate(db, 'meetings', meetingId, kind, publicUrl, agentId);
}
