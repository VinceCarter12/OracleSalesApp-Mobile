// F-007 Phase 2 (2026-07-28): the WRITE path for the Collection & Delivery
// outcomes. Mirrors client-service.ts/meeting-service.ts: update the local
// SQLite row first (sync_status='pending' so a sync-down can't clobber it —
// the appliers guard on `WHERE sync_status='synced'`), enqueue an outbox
// UPDATE row, then kick a best-effort background push. The field roles only
// ever UPDATE rows the admin published (never INSERT).
//
// Phase 2b (2026-07-29): proof photos now ride the generalized `pending_uploads`
// lane. Each captured photo is queued right after the outcome's outbox row so
// the upload's eventual URL patch (enqueuePhotoUrlUpdate) targets a row whose
// outcome has already synced (the queue's own dependency guard enforces this).
// The receiver signature is NOT queued yet — SignaturePad emits no image file.

import { enqueueOutboxRow } from './sync/entity-registry';
import { enqueuePendingUpload } from './sync/photo-uploads';
import { buildPhotoStoragePath, type PhotoKind, type PhotoParentTable } from './sync/photo-upload-registry';
import { enqueueCollectionPayment } from './sync/collection-payments';
import { runSync } from './sync-engine';
import { uuidv4 } from './uuid';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { CodMethod, PaymentMethod } from './collection-delivery-data';

interface Gps {
  lat: number;
  lng: number;
}

/**
 * Queues one captured proof photo onto the shared upload lane. Best-effort: a
 * queueing failure must never undo an already-saved outcome (same discipline as
 * meeting-service.ts's photo queue). No-op when nothing was captured.
 */
async function queuePhoto(
  db: SQLiteDatabase,
  parentTable: PhotoParentTable,
  parentId: string,
  agentId: string,
  kind: PhotoKind,
  localUri: string | undefined,
): Promise<void> {
  if (!localUri) return;
  const storagePath = buildPhotoStoragePath(parentTable, agentId, parentId, kind);
  try {
    await enqueuePendingUpload(db, { parentTable, parentId, agentId, kind, localUri, storagePath });
  } catch (err) {
    console.error('[collection-delivery-write] failed to queue photo upload:', err instanceof Error ? err.message : String(err));
  }
}

async function enqueueUpdate(
  db: SQLiteDatabase,
  tableName: 'collection_visits' | 'purchase_orders',
  recordId: string,
  payload: Record<string, unknown>,
  now: string,
): Promise<void> {
  await enqueueOutboxRow(db, {
    outboxId: uuidv4(),
    recordId,
    tableName,
    operation: 'update',
    payload: JSON.stringify(payload),
    createdAt: now,
  });
}

/**
 * Collect Payment (wireframe c-visit → cConfirmCollect). F-007 Partial payment
 * (web 070): records ONE payment against the visit — full or partial — by
 * queueing a `collection_payments` row (offline; uploaded-then-inserted by
 * lib/sync/collection-payments.ts, since collector RLS is insert-only). The
 * visit's real amount_collected/status roll-up is owned by the server trigger;
 * we mirror it optimistically on the local row so the collector sees the new
 * balance + Partial/Collected immediately (offline too).
 */
export async function collectPayment(
  db: SQLiteDatabase,
  id: string,
  collectorId: string,
  args: {
    method: PaymentMethod;
    amount: number;
    gps?: Gps;
    remarks?: string;
    paymentPhotoUri?: string;
    receiptPhotoUri?: string;
    /**
     * Customer acknowledgment signature (JPEG). Captured for every payment
     * method, but NOT yet persisted: `collection_payments` (web 070) has no
     * signature column and the upload registry has no collection-signature kind.
     * Wiring it needs a web column + a registry entry — a cross-repo follow-up.
     */
    signatureUri?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const gpsLat = args.gps?.lat ?? null;
  const gpsLng = args.gps?.lng ?? null;
  const remarks = args.remarks?.trim() || null;

  // Mirror the server roll-up (web 070): add this payment to the running total,
  // flip to 'collected' once it reaches the due, else 'partial' (still owing).
  const visit = await db.getFirstAsync<{ amount_due: number | null; amount_collected: number | null }>(
    'SELECT amount_due, amount_collected FROM collection_visits WHERE id = ?',
    [id],
  );
  const due = visit?.amount_due ?? 0;
  const newCollected = (visit?.amount_collected ?? 0) + args.amount;
  const newStatus = due > 0 && newCollected < due ? 'partial' : 'collected';

  await enqueueCollectionPayment(db, {
    id: uuidv4(),
    visitId: id,
    collectorId,
    amount: args.amount,
    paymentMethod: args.method,
    paymentPhotoUri: args.paymentPhotoUri ?? null,
    receiptPhotoUri: args.receiptPhotoUri ?? null,
    gpsLat,
    gpsLng,
    remarks,
    paidAt: now,
  });

  // Optimistic local roll-up. Deliberately leaves sync_status untouched (this is
  // NOT a visit outbox update — the payment insert + server trigger are the real
  // write); the next sync-down overwrites these with the authoritative totals.
  await db.runAsync(
    `UPDATE collection_visits
       SET status=?, collector_id=?, amount_collected=?, payment_method=?, visited_at=?,
           gps_lat=?, gps_lng=?, local_updated_at=?
     WHERE id=?`,
    [newStatus, collectorId, newCollected, args.method, now, gpsLat, gpsLng, now, id],
  );

  runSync(collectorId).catch((err) => console.error('[collection-delivery-write] payment sync failed:', err));
}

/**
 * Claim a pending stop — the "On the way" hard lock (web 046). Writes all three
 * claim columns together (a CHECK rejects a partial claim). Optimistic: the
 * local row locks immediately and the outbox pushes it; if someone already
 * holds it (or you already hold another), the push fails with Postgres 23505
 * and the row's sync_status reflects it — a "your claim didn't stick" surface
 * is a follow-up (web doc §11 offline note).
 */
export async function claimStop(
  db: SQLiteDatabase,
  table: 'collection_visits' | 'purchase_orders',
  id: string,
  profileId: string,
  fullName: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE ${table} SET claimed_by=?, claimed_at=?, claimed_by_name=?, sync_status='pending', local_updated_at=? WHERE id=?`,
    [profileId, now, fullName, now, id],
  );
  await enqueueUpdate(db, table, id, { claimed_by: profileId, claimed_at: now, claimed_by_name: fullName }, now);
  runSync(profileId).catch((err) => console.error('[collection-delivery-write] claim sync failed:', err));
}

/** Release a claim — null all three columns (web 046). Allowed for the claimer. */
export async function releaseStop(
  db: SQLiteDatabase,
  table: 'collection_visits' | 'purchase_orders',
  id: string,
  profileId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE ${table} SET claimed_by=NULL, claimed_at=NULL, claimed_by_name=NULL, sync_status='pending', local_updated_at=? WHERE id=?`,
    [now, id],
  );
  await enqueueUpdate(db, table, id, { claimed_by: null, claimed_at: null, claimed_by_name: null }, now);
  runSync(profileId).catch((err) => console.error('[collection-delivery-write] release sync failed:', err));
}

/**
 * F-007 Additional Collection (web 068/069): the collector opened an additional
 * store's screen — flag the local "seen" intent so the ack reconciler
 * (lib/sync/additional-acks.ts) stamps `additional_seen_at` via the
 * collector-only RPC on the next online pass. Local-only + idempotent: the
 * guard makes a second open, or an already-seen row, a no-op — and it kicks a
 * best-effort sync so an online collector reports "Viewed" right away.
 * NOTE: never sets sync_status='pending' — the ack is an RPC, not an outbox
 * upsert, and must not block sync-down from refreshing the row.
 */
export async function markAdditionalSeen(db: SQLiteDatabase, id: string, profileId: string): Promise<void> {
  const result = await db.runAsync(
    `UPDATE collection_visits
       SET additional_seen_pending = 1
     WHERE id = ? AND is_additional = 1 AND additional_seen_at IS NULL AND additional_seen_pending = 0`,
    [id],
  );
  if (result.changes > 0) {
    runSync(profileId).catch((err) => console.error('[collection-delivery-write] seen sync failed:', err));
  }
}

/** Reschedule a pending visit to a new day (wireframe cCloseResched). */
export async function rescheduleVisit(
  db: SQLiteDatabase,
  id: string,
  rescheduledToIso: string,
  collectorId: string,
  remarks?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const reason = remarks?.trim() || null;

  await db.runAsync(
    `UPDATE collection_visits
       SET status='rescheduled', rescheduled_to=?, remarks=?, sync_status='pending', local_updated_at=?
     WHERE id=?`,
    [rescheduledToIso, reason, now, id],
  );
  await enqueueUpdate(db, 'collection_visits', id, {
    status: 'rescheduled',
    rescheduled_to: rescheduledToIso,
    remarks: reason,
  }, now);

  runSync(collectorId).catch((err) => console.error('[collection-delivery-write] reschedule sync failed:', err));
}

/** Next sequence_no in this driver's own run — position is assigned at delivery time. */
async function nextSequenceNo(db: SQLiteDatabase, driverId: string): Promise<number> {
  const row = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next FROM purchase_orders WHERE driver_id = ?',
    [driverId],
  );
  return row?.next ?? 1;
}

/** Mark a PO delivered (wireframe d-deliver → dConfirmDeliver). */
export async function deliverPo(
  db: SQLiteDatabase,
  id: string,
  driverId: string,
  args: {
    plate: string;
    receiver?: string;
    signed: boolean;
    gps?: Gps;
    cod?: { amount: number; method: CodMethod };
    proofUri?: string;
    codPhotoUri?: string;
    signatureUri?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const seq = await nextSequenceNo(db, driverId);
  const receiver = args.receiver?.trim() || null;
  const gpsLat = args.gps?.lat ?? null;
  const gpsLng = args.gps?.lng ?? null;
  const codAmount = args.cod ? args.cod.amount : null;
  const codMethod = args.cod ? args.cod.method : null;

  await db.runAsync(
    `UPDATE purchase_orders
       SET status='delivered', driver_id=?, time_in=?, time_out=?, sequence_no=?, truck_plate=?,
           receiver_name=?, gps_lat=?, gps_lng=?, cod_amount=?, cod_method=?, cod_remitted=0,
           sync_status='pending', local_updated_at=?
     WHERE id=?`,
    [driverId, now, now, seq, args.plate, receiver, gpsLat, gpsLng, codAmount, codMethod, now, id],
  );

  const payload: Record<string, unknown> = {
    status: 'delivered',
    driver_id: driverId,
    time_in: now,
    time_out: now,
    sequence_no: seq,
    truck_plate: args.plate,
    receiver_name: receiver,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
  };
  if (args.cod) {
    payload.cod_amount = args.cod.amount;
    payload.cod_method = args.cod.method;
    payload.cod_remitted = false;
  }
  await enqueueUpdate(db, 'purchase_orders', id, payload, now);

  await queuePhoto(db, 'purchase_orders', id, driverId, 'proof', args.proofUri);
  await queuePhoto(db, 'purchase_orders', id, driverId, 'signature', args.signatureUri);
  if (args.cod) {
    await queuePhoto(db, 'purchase_orders', id, driverId, 'cod', args.codPhotoUri);
  }

  runSync(driverId).catch((err) => console.error('[collection-delivery-write] deliver sync failed:', err));
}

/** Mark a PO failed = backload (wireframe dFailedBackload). The backload photo is queued as proof the goods rode back. */
export async function failPo(
  db: SQLiteDatabase,
  id: string,
  driverId: string,
  args: { gps?: Gps; backloadUri?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const seq = await nextSequenceNo(db, driverId);
  const gpsLat = args.gps?.lat ?? null;
  const gpsLng = args.gps?.lng ?? null;

  await db.runAsync(
    `UPDATE purchase_orders
       SET status='failed', driver_id=?, time_in=?, time_out=?, sequence_no=?, gps_lat=?, gps_lng=?,
           sync_status='pending', local_updated_at=?
     WHERE id=?`,
    [driverId, now, now, seq, gpsLat, gpsLng, now, id],
  );
  await enqueueUpdate(db, 'purchase_orders', id, {
    status: 'failed',
    driver_id: driverId,
    time_in: now,
    time_out: now,
    sequence_no: seq,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
  }, now);

  await queuePhoto(db, 'purchase_orders', id, driverId, 'backload', args.backloadUri);

  runSync(driverId).catch((err) => console.error('[collection-delivery-write] fail sync failed:', err));
}
