// F-007 (2026-07-28): maps local SQLite collection_visits / purchase_orders
// rows (synced down from web 043-046) into the CollectionStore / DeliveryPo
// display shapes the screens already use. Keeps the screens unchanged in shape
// while their data source flips from the mock arrays to the real mirror.

import type {
  CollectionStore,
  CollectionStoreStatus,
  CodMethod,
  DeliveryPo,
  DeliveryPoStatus,
  PaymentMethod,
} from './collection-delivery-data';

export interface LocalCollectionVisitRow {
  id: string;
  client_id: string | null;
  client_name: string | null;
  area: string | null;
  status: string;
  scheduled_for: string | null;
  amount_due: number | null;
  collector_id: string | null;
  amount_collected: number | null;
  payment_method: string | null;
  payment_photo_url: string | null;
  delivery_receipt_photo_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  remarks: string | null;
  rescheduled_to: string | null;
  visited_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  claimed_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LocalPurchaseOrderRow {
  id: string;
  po_number: string | null;
  client_id: string | null;
  client_name: string | null;
  area: string | null;
  status: string;
  scheduled_for: string | null;
  cod: number;
  cod_due: number | null;
  driver_id: string | null;
  truck_plate: string | null;
  sequence_no: number | null;
  receiver_name: string | null;
  receiver_signature_url: string | null;
  time_in: string | null;
  time_out: string | null;
  proof_url: string | null;
  backload_photo_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  remarks: string | null;
  cod_amount: number | null;
  cod_method: string | null;
  cod_photo_url: string | null;
  cod_remitted: number;
  claimed_by: string | null;
  claimed_at: string | null;
  claimed_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Two-letter initials from a customer name (e.g. "KVR Hardware" → "KV"). */
export function initialsFromCompany(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Short date label for a reschedule target, e.g. '2026-07-11...' → 'Jul 11'. */
function shortDate(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function rowToStore(row: LocalCollectionVisitRow): CollectionStore {
  const pending = row.status === 'pending';
  return {
    id: row.id,
    name: row.client_name ?? '(walang pangalan)',
    area: row.area ?? '',
    initials: initialsFromCompany(row.client_name),
    due: row.amount_due ?? 0,
    status: (row.status as CollectionStoreStatus) ?? 'pending',
    method: (row.payment_method as PaymentMethod) ?? undefined,
    amountCollected: row.amount_collected ?? undefined,
    visitedAt: row.visited_at ?? undefined,
    gpsLat: row.gps_lat ?? undefined,
    gpsLng: row.gps_lng ?? undefined,
    reschedTo: shortDate(row.rescheduled_to),
    // 046: a pending row held by anyone is "on the way". Phase 1 is read-only,
    // so we don't yet distinguish "mine vs someone else's".
    onTheWay: pending && !!row.claimed_by,
    claimedBy: row.claimed_by_name ?? undefined,
  };
}

export function rowToPo(row: LocalPurchaseOrderRow): DeliveryPo {
  const pending = row.status === 'pending';
  return {
    id: row.id,
    po: row.po_number ?? '',
    client: row.client_name ?? '(walang pangalan)',
    area: row.area ?? '',
    status: (row.status as DeliveryPoStatus) ?? 'pending',
    plate: row.truck_plate ?? undefined,
    seq: row.sequence_no ?? undefined,
    receiver: row.receiver_name ?? undefined,
    signed: !!row.receiver_signature_url,
    timeIn: row.time_in ?? undefined,
    timeOut: row.time_out ?? undefined,
    gpsLat: row.gps_lat ?? undefined,
    gpsLng: row.gps_lng ?? undefined,
    backloadCaptured: !!row.backload_photo_url,
    cod: row.cod === 1,
    codDue: row.cod_due ?? undefined,
    codAmount: row.cod_amount ?? undefined,
    codMethod: (row.cod_method as CodMethod) ?? undefined,
    codRemitted: row.cod_remitted === 1,
    onTheWay: pending && !!row.claimed_by,
    claimedBy: row.claimed_by_name ?? undefined,
  };
}
