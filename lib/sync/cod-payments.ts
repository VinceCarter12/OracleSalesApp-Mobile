import { File } from 'expo-file-system';
import { supabase } from '../supabase';
import { classifySyncError, backoffDelayMs, MAX_OUTBOX_ATTEMPTS } from './outbox-status';
import { buildPhotoStoragePath, publicUrlFor, uploadPhotoToBucket } from './photo-upload-registry';
import type { SQLiteDatabase } from 'expo-sqlite';

// F-007 Delivery partial COD (web migration 073, 2026-08-09). The delivery twin
// of lib/sync/collection-payments.ts. A driver records a COD handover (full or
// partial) by INSERTing a `cod_payments` row; a server trigger sums payments onto
// the PO (cod_amount + status pending->partial->delivered). Driver RLS is INSERT +
// SELECT own only (NO UPDATE), so the proof photo URL must be present IN the
// insert — hence each payment is its own offline queue row here, and this
// processor UPLOADS the photo first, THEN inserts the payment with its URL.
//
// ONE thing that differs from collection (web 073 ordering guard): a COD payment
// may only land AFTER the PO's HANDOVER (driver_id + time_out) has reached the
// server — a `partial`/`delivered` status is only legal on a handed-over row. So
// processCodPayments gates each insert on the parent PO being locally 'synced'
// (its handover outbox UPDATE pushed). Until then the payment waits; the enclosing
// sync pass pushes the handover BEFORE this runs (see sync-engine.ts ordering), so
// a first-delivery + payment settle in the same online pass.

const DELIVERY_PROOFS_BUCKET = 'delivery-proofs';

export interface EnqueueCodPaymentInput {
  /** Client-generated UUID — reused as the remote row's id so a retried insert is idempotent (duplicate PK = already landed). */
  id: string;
  poId: string;
  driverId: string;
  amount: number;
  paymentMethod: string;
  paymentPhotoUri?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  remarks?: string | null;
  paidAt: string;
}

/** Queues one COD payment for offline upload-then-insert. Called from collection-delivery-write.ts (deliverPo / collectCodTopUp). */
export async function enqueueCodPayment(db: SQLiteDatabase, input: EnqueueCodPaymentInput): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO cod_payments
      (id, po_id, driver_id, amount, payment_method, payment_photo_uri,
       gps_lat, gps_lng, remarks, paid_at, status, retry_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
    [
      input.id,
      input.poId,
      input.driverId,
      input.amount,
      input.paymentMethod,
      input.paymentPhotoUri ?? null,
      input.gpsLat ?? null,
      input.gpsLng ?? null,
      input.remarks ?? null,
      input.paidAt,
      now,
    ],
  );
}

interface PendingCodPaymentRow {
  id: string;
  po_id: string;
  driver_id: string;
  amount: number;
  payment_method: string;
  payment_photo_uri: string | null;
  payment_photo_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  remarks: string | null;
  paid_at: string;
  retry_count: number;
}

/** Supabase Storage "object already exists" (409) — a deterministic path means a retry after a partial success is fine; reuse the existing object's URL. */
function isAlreadyExistsError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { status, statusCode, message } = err as { status?: number; statusCode?: string; message?: string };
  if (status === 409) return true;
  if (typeof statusCode === 'string' && /duplicate/i.test(statusCode)) return true;
  return typeof message === 'string' && /already exists/i.test(message);
}

/**
 * Uploads the COD proof photo if there's a local file that hasn't been uploaded
 * yet, persists the resulting URL onto the local row (so an insert-retry never
 * re-uploads), and returns it. Returns the already-known URL when present, or
 * null when there's no local file (or it's gone from the cache) — a missing proof
 * must not block the payment from recording.
 */
async function uploadProofIfNeeded(
  db: SQLiteDatabase,
  row: PendingCodPaymentRow,
): Promise<string | null> {
  if (row.payment_photo_url) return row.payment_photo_url;
  if (!row.payment_photo_uri || !new File(row.payment_photo_uri).exists) return null;

  const storagePath = buildPhotoStoragePath('purchase_orders', row.driver_id, row.id, 'cod');
  let url: string;
  try {
    url = await uploadPhotoToBucket(row.payment_photo_uri, storagePath, DELIVERY_PROOFS_BUCKET);
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      url = publicUrlFor(DELIVERY_PROOFS_BUCKET, storagePath);
    } else {
      throw err; // real upload failure — let processOne classify + retry
    }
  }
  await db.runAsync('UPDATE cod_payments SET payment_photo_url = ? WHERE id = ?', [url, row.id]);
  return url;
}

async function processOne(db: SQLiteDatabase, row: PendingCodPaymentRow): Promise<'synced' | 'failed' | 'retry'> {
  try {
    const photoUrl = await uploadProofIfNeeded(db, row);

    const { error } = await supabase.from('cod_payments').insert({
      id: row.id,
      po_id: row.po_id,
      driver_id: row.driver_id,
      amount: row.amount,
      payment_method: row.payment_method as 'cash' | 'check' | 'gcash',
      payment_photo_url: photoUrl,
      gps_lat: row.gps_lat,
      gps_lng: row.gps_lng,
      remarks: row.remarks,
      paid_at: row.paid_at,
    });
    if (error) throw error;

    await db.runAsync("UPDATE cod_payments SET status = 'synced', last_error = NULL WHERE id = ?", [row.id]);
    return 'synced';
  } catch (err) {
    const classified = classifySyncError(err);
    // Duplicate PK (23505) — a prior attempt already inserted this exact payment
    // (its client UUID). Idempotent success, not a real conflict.
    if (classified.kind === 'conflict') {
      await db.runAsync("UPDATE cod_payments SET status = 'synced', last_error = NULL WHERE id = ?", [row.id]);
      return 'synced';
    }
    if (classified.kind === 'transient') {
      const nextRetry = row.retry_count + 1;
      if (nextRetry < MAX_OUTBOX_ATTEMPTS) {
        const nextAt = new Date(Date.now() + backoffDelayMs(nextRetry)).toISOString();
        await db.runAsync(
          'UPDATE cod_payments SET retry_count = ?, next_attempt_at = ?, last_error = ? WHERE id = ?',
          [nextRetry, nextAt, classified.message, row.id],
        );
        return 'retry';
      }
      await db.runAsync("UPDATE cod_payments SET status = 'failed', retry_count = ?, last_error = ? WHERE id = ?", [
        nextRetry,
        classified.message,
        row.id,
      ]);
      return 'failed';
    }
    // permanent (bad payload, RLS denial, etc.) — dead-letter, no retry.
    await db.runAsync("UPDATE cod_payments SET status = 'failed', last_error = ? WHERE id = ?", [
      classified.message,
      row.id,
    ]);
    return 'failed';
  }
}

export interface CodPaymentSyncResult {
  synced: number;
  failed: number;
}

/**
 * Drains the driver's due `pending` COD payments (respects next_attempt_at, FIFO
 * by created_at). Called from runSyncOnce() BEFORE sync-down (so the server
 * trigger's roll-up onto the PO is pulled back in the same pass) and AFTER the
 * outbox push (so a first-delivery's handover UPDATE has already synced). The
 * `sync_status = 'synced'` guard on the parent PO enforces the web 073 ordering
 * rule: a payment never lands on a not-yet-handed-over row. One bad row never
 * blocks the rest.
 */
export async function processCodPayments(db: SQLiteDatabase, agentId: string): Promise<CodPaymentSyncResult> {
  const now = new Date().toISOString();
  const rows = await db.getAllAsync<PendingCodPaymentRow>(
    `SELECT c.id, c.po_id, c.driver_id, c.amount, c.payment_method, c.payment_photo_uri,
            c.payment_photo_url, c.gps_lat, c.gps_lng, c.remarks, c.paid_at, c.retry_count
     FROM cod_payments c
     JOIN purchase_orders p ON p.id = c.po_id
     WHERE c.driver_id = ? AND c.status = 'pending'
       AND (c.next_attempt_at IS NULL OR c.next_attempt_at <= ?)
       AND p.sync_status = 'synced'
     ORDER BY c.created_at ASC`,
    [agentId, now],
  );

  const result: CodPaymentSyncResult = { synced: 0, failed: 0 };
  for (const row of rows) {
    try {
      const outcome = await processOne(db, row);
      if (outcome === 'synced') result.synced++;
      if (outcome === 'failed') result.failed++;
    } catch (err) {
      // Defensive: an unexpected throw must never stop the remaining payments.
      console.error('[cod-payments] unexpected failure for', row.id, err);
      result.failed++;
    }
  }
  return result;
}
