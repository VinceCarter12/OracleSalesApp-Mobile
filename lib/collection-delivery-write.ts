// F-007 Phase 2 (2026-07-28): the WRITE path for the Collection & Delivery
// outcomes. Mirrors client-service.ts/meeting-service.ts: update the local
// SQLite row first (sync_status='pending' so a sync-down can't clobber it —
// the appliers guard on `WHERE sync_status='synced'`), enqueue an outbox
// UPDATE row, then kick a best-effort background push. The field roles only
// ever UPDATE rows the admin published (never INSERT).
//
// Photos and real GPS are Phase 2b — the outcome rows land with null photo
// URLs (schema allows it; web shows "missing proof") and mock GPS for now.

import { enqueueOutboxRow } from './sync/entity-registry';
import { runSync } from './sync-engine';
import { uuidv4 } from './uuid';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { CodMethod, PaymentMethod } from './collection-delivery-data';

interface Gps {
  lat: number;
  lng: number;
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

/** Collect Payment (wireframe c-visit → cConfirmCollect). Writes the collected outcome. */
export async function collectPayment(
  db: SQLiteDatabase,
  id: string,
  collectorId: string,
  args: { method: PaymentMethod; amount: number; gps?: Gps; remarks?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const gpsLat = args.gps?.lat ?? null;
  const gpsLng = args.gps?.lng ?? null;
  const remarks = args.remarks?.trim() || null;

  await db.runAsync(
    `UPDATE collection_visits
       SET status='collected', collector_id=?, amount_collected=?, payment_method=?, visited_at=?,
           gps_lat=?, gps_lng=?, remarks=?, sync_status='pending', local_updated_at=?
     WHERE id=?`,
    [collectorId, args.amount, args.method, now, gpsLat, gpsLng, remarks, now, id],
  );
  await enqueueUpdate(db, 'collection_visits', id, {
    status: 'collected',
    collector_id: collectorId,
    amount_collected: args.amount,
    payment_method: args.method,
    visited_at: now,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
    remarks,
  }, now);

  runSync(collectorId).catch((err) => console.error('[collection-delivery-write] collect sync failed:', err));
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
  args: { plate: string; receiver?: string; signed: boolean; gps?: Gps; cod?: { amount: number; method: CodMethod } },
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

  runSync(driverId).catch((err) => console.error('[collection-delivery-write] deliver sync failed:', err));
}

/** Mark a PO failed = backload (wireframe dFailedBackload). Backload photo upload is Phase 2b. */
export async function failPo(
  db: SQLiteDatabase,
  id: string,
  driverId: string,
  args: { gps?: Gps },
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

  runSync(driverId).catch((err) => console.error('[collection-delivery-write] fail sync failed:', err));
}
