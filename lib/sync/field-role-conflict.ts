import type { EntityTableName } from './entity-registry';

// F-007 (web 043-046 / 068-070): the admin-published Collection & Delivery day
// lists (`collection_visits`, `purchase_orders`) are the one class of outbox
// rows whose SERVER copy legitimately keeps advancing WITHOUT the phone being
// the writer:
//
//   - web 070 partial payments: inserting a `collection_payments` row fires a
//     SECURITY DEFINER roll-up trigger that REWRITES the parent visit
//     (status/amount_collected/collector_id/payment_method/proof URLs/gps/
//     visited_at). The phone inserts the payment and never touches these
//     columns itself — the server owns them.
//   - web 069 additional acks: `additional_received_at`/`additional_seen_at`
//     are stamped by the collector-only RPCs, which bump the row server-side.
//   - web 046 claims: an admin releasing a claim NULLs claimed_by/claimed_at/
//     claimed_by_name; a rival claim already holding the row rejects the phone's
//     claim with a unique violation.
//
// Each of those advances the visit's server version. When the phone later
// flushes an outbox UPDATE that touches ONLY these server-owned columns and it
// comes back a unique-violation conflict, that's an EXPECTED "the server
// already moved on" outcome — NOT a real two-writer edit collision. The right
// resolution is server-wins (adopt the server row, drop the stale local edit),
// never freezing the record and telling the field officer to phone the office.
//
// The guard is deliberately narrow: it only auto-resolves when EVERY column in
// the payload is server-owned. A reschedule (which also writes `rescheduled_to`
// / `remarks` — genuine collector intent that isn't server-derived) fails this
// check and keeps the normal conflict path, so a real collision is never
// silently discarded.

const SERVER_OWNED_COLUMNS: Partial<Record<EntityTableName, ReadonlySet<string>>> = {
  collection_visits: new Set([
    // web 070 roll-up trigger owns these — the phone inserts a payment instead.
    'status',
    'amount_collected',
    'collector_id',
    'payment_method',
    'payment_photo_url',
    'delivery_receipt_photo_url',
    'gps_lat',
    'gps_lng',
    'visited_at',
    // web 069 acks — stamped by the collector-only RPCs, never a direct update.
    'additional_received_at',
    'additional_seen_at',
    // web 046 claims — admin can release (null) these out from under the phone.
    'claimed_by',
    'claimed_at',
    'claimed_by_name',
  ]),
  purchase_orders: new Set([
    'status',
    'driver_id',
    'time_in',
    'time_out',
    'sequence_no',
    'truck_plate',
    'receiver_name',
    'receiver_signature_url',
    'proof_url',
    'backload_photo_url',
    'gps_lat',
    'gps_lng',
    'cod_amount',
    'cod_method',
    'cod_remitted',
    'claimed_by',
    'claimed_at',
    'claimed_by_name',
  ]),
};

/**
 * True when a conflicted outbox UPDATE for a field-role day-list table touches
 * ONLY server-owned columns — i.e. the conflict is an expected "server already
 * moved on" divergence that should resolve server-wins, not a real collision
 * to freeze for admin review. Returns false for any other table, an empty
 * payload, an unparseable payload, or a payload that also writes a
 * collector-owned column (e.g. a reschedule's `rescheduled_to`/`remarks`).
 */
export function isServerOwnedFieldRoleConflict(tableName: string, payloadJson: string): boolean {
  const owned = SERVER_OWNED_COLUMNS[tableName as EntityTableName];
  if (!owned) return false;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return false;
  }

  const keys = Object.keys(parsed);
  if (keys.length === 0) return false;
  return keys.every((key) => owned.has(key));
}
