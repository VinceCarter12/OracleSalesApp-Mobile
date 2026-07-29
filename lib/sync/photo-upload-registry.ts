import { File } from 'expo-file-system';
import { supabase } from '../supabase';
import { uuidv4 } from '../uuid';
import { runSync } from '../sync-engine';
import { enqueueOutboxRow, type EntityTableName } from './entity-registry';
import { isLikelyOnline } from './connectivity';
import { withTimeout } from '../with-timeout';
import type { SQLiteDatabase } from 'expo-sqlite';

// F-007 Phase 2b (2026-07-29): generalizes the meeting-only `pending_uploads`
// lane (T-014 Phase C) into a cross-entity photo-upload registry. A queued
// photo now names its PARENT (meetings | collection_visits | purchase_orders)
// and its KIND; this registry is the single place that maps each kind to the
// Storage bucket it uploads to and the remote/local columns its public URL
// patches once the object exists. meeting-photo-service.ts keeps its
// meeting-named wrappers but delegates here so there is one source of truth,
// and lib/sync/photo-uploads.ts drives the queue generically for every kind.

export type PhotoParentTable = 'meetings' | 'collection_visits' | 'purchase_orders';

// selfie/start/end = meetings (existing); the rest are F-007 collection &
// delivery proofs. 'start' intentionally has NO registry entry below and so
// fails fast — it's schema headroom no screen produces (ADR-028). 'signature'
// (delivery receiver signature) IS wired (SignaturePad renders to a JPEG as of
// Phase 2b). Note the REMITTANCE signatures don't use this lane at all — those
// tables have no UPDATE RLS policy, so their URLs go in the insert directly
// (see lib/remittance-write.ts), not via a deferred patch.
export type PhotoKind =
  | 'selfie'
  | 'start'
  | 'end'
  | 'payment'
  | 'delivery_receipt'
  | 'proof'
  | 'backload'
  | 'cod'
  | 'signature';

export interface PhotoUploadKindConfig {
  parentTable: PhotoParentTable;
  /** Supabase Storage bucket the image is uploaded to. */
  bucket: string;
  /** Remote Supabase column patched with the public URL after upload. */
  remoteColumn: string;
  /** Local SQLite mirror column updated in lockstep (usually === remoteColumn). */
  localColumn: string;
}

/**
 * The one place that knows where each photo kind belongs. A kind with no entry
 * is rejected before any Storage call (see processOneRow in photo-uploads.ts),
 * so a real upload is never orphaned behind a parent row it could never patch.
 *
 * Column names are verified against the WEB migrations, not the contract doc:
 * `043_collection_module.sql` (collection_visits) and `044_delivery_module.sql`
 * (purchase_orders). Note `proof_url` — NOT `proof_photo_url` — and `cod_photo_url`
 * lives on purchase_orders, not cod_remittances (the COLLECTION_DELIVERY_FOR_MOBILE
 * §5b summary was wrong on both; the migration SQL is authoritative).
 */
export const PHOTO_UPLOAD_KINDS: Partial<Record<PhotoKind, PhotoUploadKindConfig>> = {
  // meetings (unchanged from the original meeting-only lane)
  selfie: { parentTable: 'meetings', bucket: 'meeting-photos', remoteColumn: 'photo_url', localColumn: 'selfie_url' },
  end: { parentTable: 'meetings', bucket: 'meeting-photos', remoteColumn: 'end_photo_url', localColumn: 'end_photo_url' },
  // collection_visits (web 043) — bucket `collection-proofs`
  payment: {
    parentTable: 'collection_visits',
    bucket: 'collection-proofs',
    remoteColumn: 'payment_photo_url',
    localColumn: 'payment_photo_url',
  },
  delivery_receipt: {
    parentTable: 'collection_visits',
    bucket: 'collection-proofs',
    remoteColumn: 'delivery_receipt_photo_url',
    localColumn: 'delivery_receipt_photo_url',
  },
  // purchase_orders (web 044) — bucket `delivery-proofs`
  proof: { parentTable: 'purchase_orders', bucket: 'delivery-proofs', remoteColumn: 'proof_url', localColumn: 'proof_url' },
  // Delivery receiver signature — purchase_orders HAS a driver UPDATE policy, so
  // (unlike the remittance signatures) this rides the deferred patch lane.
  signature: {
    parentTable: 'purchase_orders',
    bucket: 'delivery-proofs',
    remoteColumn: 'receiver_signature_url',
    localColumn: 'receiver_signature_url',
  },
  backload: {
    parentTable: 'purchase_orders',
    bucket: 'delivery-proofs',
    remoteColumn: 'backload_photo_url',
    localColumn: 'backload_photo_url',
  },
  cod: { parentTable: 'purchase_orders', bucket: 'delivery-proofs', remoteColumn: 'cod_photo_url', localColumn: 'cod_photo_url' },
};

// Larger payload than a row upsert (SYNC_TIMEOUT_MS=15000 in remote-upsert.ts)
// — a 1-3MB compressed photo (ADR-008) needs more room on a degraded link.
// Kept identical to meeting-photo-service's original constant.
export const PHOTO_UPLOAD_TIMEOUT_MS = 30000;

/**
 * Deterministic per-parent storage path, built once by the caller (right after
 * the parent row exists) and reused on every retry — required for the "409
 * already exists = success" idempotency guarantee. Camera capture is JPEG-only
 * (ImagePicker default), so the extension is always `.jpg`.
 *
 * `meetings` KEEPS its original `meetings/${userId}/...` prefix EXACTLY — an
 * in-flight meeting row already stored that path and idempotency depends on it
 * never changing. collection/delivery get their own prefixes (buckets already
 * separate them, but a prefix keeps objects readable in the Storage browser).
 */
export function buildPhotoStoragePath(
  parentTable: PhotoParentTable,
  userId: string,
  parentId: string,
  kind: PhotoKind,
): string {
  const prefix =
    parentTable === 'meetings' ? 'meetings' : parentTable === 'collection_visits' ? 'collection' : 'delivery';
  return `${prefix}/${userId}/${parentId}-${kind}.jpg`;
}

/**
 * Uploads a locally captured photo to the given bucket and returns its public
 * URL. Reads raw bytes via SDK 57's `File.bytes()` rather than a RN Blob (the
 * RN Blob polyfill can't round-trip an ArrayBuffer through supabase-storage-js).
 * Races a timeout so a stalled/degraded link surfaces as a catchable error
 * instead of hanging the queue. `storagePath` must be the SAME across retries
 * so a 409 after a partial success can be treated as success by the caller.
 */
export async function uploadPhotoToBucket(localUri: string, storagePath: string, bucket: string): Promise<string> {
  const bytes = await new File(localUri).bytes();
  const { error } = await withTimeout(
    supabase.storage.from(bucket).upload(storagePath, bytes, { contentType: 'image/jpeg' }),
    PHOTO_UPLOAD_TIMEOUT_MS,
    `photo upload (${storagePath})`,
  );
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}

/** Public URL for an object already in Storage — used when an upload retry gets a 409 "already exists" (the object is there, we just need its URL). */
export function publicUrlFor(bucket: string, storagePath: string): string {
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Patches a parent row's photo column once its queued upload has confirmed the
 * object exists in Storage. One local transaction (column update + outbox
 * enqueue) then a best-effort immediate sync — rides the parent's
 * ALREADY-EXISTING entity-registry outbox lane, no new dispatch code needed.
 * Generalizes the old `enqueueMeetingPhotoUrlUpdate` to any registered parent.
 */
export async function enqueuePhotoUrlUpdate(
  db: SQLiteDatabase,
  parentTable: PhotoParentTable,
  parentId: string,
  kind: PhotoKind,
  publicUrl: string,
  agentId: string,
): Promise<void> {
  const config = PHOTO_UPLOAD_KINDS[kind];
  if (!config) {
    throw new Error(`enqueuePhotoUrlUpdate: unsupported photo kind "${kind}"`);
  }
  const outboxId = uuidv4();
  const now = new Date().toISOString();
  const createdOnline = await isLikelyOnline();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE ${parentTable} SET ${config.localColumn} = ?, sync_status = 'pending', local_updated_at = ? WHERE id = ?`,
      [publicUrl, now, parentId],
    );
    await enqueueOutboxRow(db, {
      outboxId,
      recordId: parentId,
      tableName: parentTable as EntityTableName,
      operation: 'update',
      payload: JSON.stringify({ id: parentId, [config.remoteColumn]: publicUrl }),
      createdAt: now,
      createdOnline,
    });
  });

  await runSync(agentId).catch((err) => {
    console.error('[photo-upload-registry] photo-url patch sync failed:', err instanceof Error ? err.message : String(err));
  });
}
