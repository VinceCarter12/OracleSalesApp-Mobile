// F-007 remittances WRITE path (web 043 collection / 044 COD). Unlike the
// collect/deliver outcome writes, the remittance tables have NO collector/driver
// UPDATE RLS policy — only INSERT + SELECT — so a photo URL can't be patched on
// after the fact. The signed-proof and signature images are therefore uploaded
// FIRST and their URLs go straight into the inserted row. Uploading needs the
// network, so submission is online-gated (capture happens in-screen; if offline
// the caller surfaces "retry when online"), mirroring PO confirmation's
// online-only submit (ADR-044). The row itself still rides the outbox so a
// failed push retries, and it syncs back down like any other entity.

import { enqueueOutboxRow } from './sync/entity-registry';
import { isLikelyOnline } from './sync/connectivity';
import { uploadPhotoToBucket } from './sync/photo-upload-registry';
import { runSync } from './sync-engine';
import { uuidv4 } from './uuid';
import type { SQLiteDatabase } from 'expo-sqlite';

const COLLECTION_BUCKET = 'collection-proofs';
const DELIVERY_BUCKET = 'delivery-proofs';

export type RemitDestination = 'office' | 'bayad_center' | 'bank_deposit';
export type SubmitRemittanceResult = 'submitted' | 'offline' | 'failed';

export interface SubmitCollectionRemittanceInput {
  destination: RemitDestination;
  amountCollected: number;
  amountRemitted: number;
  /**
   * F-007 per-payment coverage (web 086): the `collection_payments` ids this
   * remittance covers — the same rows summed into `amountRemitted`. Each is
   * linked to the new remittance (`remittance_id`) as the source of truth;
   * their distinct `visit_id`s are still written to `remittances.visit_ids` for
   * back-compat.
   */
  paymentIds: string[];
  /** Required for office (schema CHECK); null for bayad_center/bank_deposit. */
  receiverName?: string | null;
  /** Photo of the signed acknowledgment receipt (office) or the receipt (711/bank). */
  signedProofUri?: string;
  /** Drawn receiver signature JPEG (office only). */
  signatureUri?: string;
}

export interface SubmitCodRemittanceInput {
  amountCollected: number;
  amountRemitted: number;
  /** The `cod_payments` ids this remittance covers (web 087); linked via `cod_remittance_id`, with their distinct `po_id`s kept in `cod_remittances.po_ids` for back-compat. */
  paymentIds: string[];
  /** NOT NULL remotely — the assigned office receiver. */
  receiverName: string;
  signatureUri?: string;
}

/** Placeholder list (`?, ?, …`) for an `IN (…)` clause. */
function inClause(count: number): string {
  return Array(count).fill('?').join(', ');
}

/** Collection remittance (wireframe c-remit). Uploads proof+signature, then inserts. */
export async function submitCollectionRemittance(
  db: SQLiteDatabase,
  collectorId: string,
  input: SubmitCollectionRemittanceInput,
): Promise<SubmitRemittanceResult> {
  if (!(await isLikelyOnline())) return 'offline';

  const id = uuidv4();
  const now = new Date().toISOString();
  const receiverName = input.receiverName?.trim() || null;

  try {
    const signedProofUrl = input.signedProofUri
      ? await uploadPhotoToBucket(input.signedProofUri, `collection/${collectorId}/remit-${id}-proof.jpg`, COLLECTION_BUCKET)
      : null;
    const signatureUrl = input.signatureUri
      ? await uploadPhotoToBucket(input.signatureUri, `collection/${collectorId}/remit-${id}-signature.jpg`, COLLECTION_BUCKET)
      : null;

    // Back-compat: derive the distinct visit_ids of the covered payments so
    // `remittances.visit_ids` keeps its old shape for anything still reading it.
    // The per-payment link (staged below) is the source of truth for coverage.
    const visitRows = input.paymentIds.length
      ? await db.getAllAsync<{ visit_id: string }>(
          `SELECT DISTINCT visit_id FROM collection_payments WHERE id IN (${inClause(input.paymentIds.length)})`,
          input.paymentIds,
        )
      : [];
    const visitIds = visitRows.map((r) => r.visit_id);
    const visitIdsJson = JSON.stringify(visitIds);
    await db.runAsync(
      `INSERT INTO remittances
         (id, collector_id, destination, amount_remitted, amount_collected, status,
          receiver_name, signed_proof_url, receiver_signature_url, visit_ids,
          submitted_at, created_at, sync_status, local_updated_at)
       VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id,
        collectorId,
        input.destination,
        input.amountRemitted,
        input.amountCollected,
        receiverName,
        signedProofUrl,
        signatureUrl,
        visitIdsJson,
        now,
        now,
        now,
      ],
    );
    await enqueueOutboxRow(db, {
      outboxId: uuidv4(),
      recordId: id,
      tableName: 'remittances',
      operation: 'insert',
      payload: JSON.stringify({
        id,
        collector_id: collectorId,
        destination: input.destination,
        amount_remitted: input.amountRemitted,
        amount_collected: input.amountCollected,
        status: 'submitted',
        receiver_name: receiverName,
        signed_proof_url: signedProofUrl,
        receiver_signature_url: signatureUrl,
        visit_ids: visitIds,
        submitted_at: now,
      }),
      createdAt: now,
      createdOnline: true,
    });

    // F-007 per-payment coverage (web 086): STAGE the link on the covered
    // payments. The actual remote UPDATE (collection_payments.remittance_id) is
    // pushed by lib/sync/remittance-link.ts once the remittance row itself has
    // landed server-side (FK ordering) — it can't ride the generic outbox
    // because collection_payments isn't an entity-registry table. Guarded to
    // this collector's own, currently-unlinked, un-staged rows (idempotent on a
    // retried submit). The row's INSERT-lane `status` is untouched.
    if (input.paymentIds.length) {
      await db.runAsync(
        `UPDATE collection_payments
            SET pending_remittance_id = ?, link_retry_count = 0, link_next_attempt_at = NULL, link_error = NULL
          WHERE id IN (${inClause(input.paymentIds.length)})
            AND collector_id = ? AND remittance_id IS NULL AND pending_remittance_id IS NULL`,
        [id, ...input.paymentIds, collectorId],
      );
    }

    runSync(collectorId).catch((err) => console.error('[remittance-write] collection remit sync failed:', err));
    return 'submitted';
  } catch (err) {
    console.error('[remittance-write] collection remit failed:', err instanceof Error ? err.message : String(err));
    return 'failed';
  }
}

/** COD delivery remittance (wireframe d-remit). Office-only. Uploads signature, inserts, and flags the covered POs cod_remitted. */
export async function submitCodRemittance(
  db: SQLiteDatabase,
  driverId: string,
  input: SubmitCodRemittanceInput,
): Promise<SubmitRemittanceResult> {
  if (!(await isLikelyOnline())) return 'offline';

  const id = uuidv4();
  const now = new Date().toISOString();
  const receiverName = input.receiverName.trim();

  try {
    const signatureUrl = input.signatureUri
      ? await uploadPhotoToBucket(input.signatureUri, `delivery/${driverId}/codremit-${id}-signature.jpg`, DELIVERY_BUCKET)
      : null;

    // Back-compat: derive the distinct po_ids of the covered COD payments for
    // `cod_remittances.po_ids`. The per-payment link (staged below) is now the
    // source of truth for coverage.
    const poRows = input.paymentIds.length
      ? await db.getAllAsync<{ po_id: string }>(
          `SELECT DISTINCT po_id FROM cod_payments WHERE id IN (${inClause(input.paymentIds.length)})`,
          input.paymentIds,
        )
      : [];
    const poIds = poRows.map((r) => r.po_id);
    const poIdsJson = JSON.stringify(poIds);
    await db.runAsync(
      `INSERT INTO cod_remittances
         (id, driver_id, amount_remitted, amount_collected, status, receiver_name,
          receiver_signature_url, po_ids, submitted_at, created_at, sync_status, local_updated_at)
       VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, driverId, input.amountRemitted, input.amountCollected, receiverName, signatureUrl, poIdsJson, now, now, now],
    );
    await enqueueOutboxRow(db, {
      outboxId: uuidv4(),
      recordId: id,
      tableName: 'cod_remittances',
      operation: 'insert',
      payload: JSON.stringify({
        id,
        driver_id: driverId,
        amount_remitted: input.amountRemitted,
        amount_collected: input.amountCollected,
        status: 'submitted',
        receiver_name: receiverName,
        receiver_signature_url: signatureUrl,
        po_ids: poIds,
        submitted_at: now,
      }),
      createdAt: now,
      createdOnline: true,
    });

    // F-007 per-payment coverage (web 087): STAGE the link on the covered COD
    // payments — pushed by lib/sync/remittance-link.ts after the cod_remittances
    // row lands (FK ordering). Own, unlinked, un-staged rows only.
    if (input.paymentIds.length) {
      await db.runAsync(
        `UPDATE cod_payments
            SET pending_cod_remittance_id = ?, link_retry_count = 0, link_next_attempt_at = NULL, link_error = NULL
          WHERE id IN (${inClause(input.paymentIds.length)})
            AND driver_id = ? AND cod_remittance_id IS NULL AND pending_cod_remittance_id IS NULL`,
        [id, ...input.paymentIds, driverId],
      );
    }

    // Back-compat: keep flagging the covered POs `cod_remitted` (per-PO boolean,
    // web note: no trigger, driver owns it via their purchase_orders UPDATE
    // policy). Mobile on-hand no longer reads this — the per-payment link above
    // is authoritative — but anything on the web still keying off cod_remitted
    // keeps working. A later top-up on a flagged PO is a fresh cod_payment with
    // a NULL link, so it correctly reappears as on hand regardless of this flag.
    for (const poId of poIds) {
      await db.runAsync(
        `UPDATE purchase_orders SET cod_remitted = 1, sync_status = 'pending', local_updated_at = ? WHERE id = ?`,
        [now, poId],
      );
      await enqueueOutboxRow(db, {
        outboxId: uuidv4(),
        recordId: poId,
        tableName: 'purchase_orders',
        operation: 'update',
        payload: JSON.stringify({ id: poId, cod_remitted: true }),
        createdAt: now,
        createdOnline: true,
      });
    }

    runSync(driverId).catch((err) => console.error('[remittance-write] cod remit sync failed:', err));
    return 'submitted';
  } catch (err) {
    console.error('[remittance-write] cod remit failed:', err instanceof Error ? err.message : String(err));
    return 'failed';
  }
}
