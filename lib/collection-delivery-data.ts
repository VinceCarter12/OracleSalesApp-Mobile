// F-007 mock data for the Collection & Delivery dashboards.
//
// 2026-07-27: aligned to web's AUTHORITATIVE model (043/044 migrations +
// COLLECTION_DELIVERY_FOR_MOBILE.md), replacing the older wireframe draft.
// Six rules from that doc are encoded here:
//   1. Delivery HAS GPS (captured with the proof photo) — the "no GPS" rule is dead.
//   2. Delivery is ONE DAY, ONE OUTCOME: 'pending' | 'delivered' | 'failed'.
//      A failed delivery IS a backload (backload photo is a capture on a failed
//      row, not a status). No 3-day follow-up, no `day` counter.
//   3. Delivery dashboard leads on backloads (failed), not a follow-up window.
//   4. A PO has NO line-items — admin lists customer + area only.
//   5. Payment methods are lowercase; collection adds 'counter' (delivery does not).
//   6. Real timestamps (ISO) + UUID string ids, not display strings / ints.
// No SQLite/Supabase schema is deployed yet (043/044 unmerged), so these arrays
// still stand in for local-DB reads — but now on the correct shapes.

export type CollectionStoreStatus = 'pending' | 'collected' | 'rescheduled';
/** Collection payment methods — lowercase; 'counter' = paid at the store's own counter. */
export type PaymentMethod = 'cash' | 'check' | 'gcash' | 'counter';
/** Delivery COD methods — no 'counter' (a counter has no meaning on a delivery). */
export type CodMethod = 'cash' | 'check' | 'gcash';

/** Display label for a stored (lowercase) payment/COD method value. */
export function paymentMethodLabel(m: PaymentMethod | CodMethod): string {
  switch (m) {
    case 'cash': return 'Cash';
    case 'check': return 'Check';
    case 'gcash': return 'GCash';
    case 'counter': return 'Counter';
  }
}

/** Formats an ISO timestamp as a wall-clock time, e.g. '8:32 AM'. Empty for null. */
export function formatClockTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export interface CollectionStore {
  /** UUID string (web `collection_visits.id`) — ints don't survive offline creation across devices. */
  id: string;
  name: string;
  area: string;
  initials: string;
  /** `amount_due` — admin-entered, NEVER shown on the Collect Payment screen (anchoring bias). */
  due: number;
  status: CollectionStoreStatus;
  /** Written at collection time. */
  method?: PaymentMethod;
  amountCollected?: number;
  /** `visited_at` — real timestamp; the ONLY signal that orders a collection trip on the map. */
  visitedAt?: string;
  /** GPS captured at payment-photo time (already agreed for collection). */
  gpsLat?: number;
  gpsLng?: number;
  reschedTo?: string;
  /**
   * MOCK-ONLY (⚠️ not in web 043/044 yet): another collector has claimed this
   * pending stop and is en route — shown so nobody double-visits. Web's schema
   * has no claimed/en-route state today (a pending row must have collector_id
   * NULL), so making this real needs a web-side field first.
   */
  onTheWay?: boolean;
  claimedBy?: string;
}

export const COLLECTION_STORES: CollectionStore[] = [
  { id: '11111111-1111-4111-8111-000000000001', name: 'KVR Hardware', area: 'Balanga', initials: 'KV', due: 12500, status: 'collected', method: 'cash', amountCollected: 12500, visitedAt: '2026-07-09T08:32:00+08:00', gpsLat: 14.6767, gpsLng: 120.5363 },
  { id: '11111111-1111-4111-8111-000000000002', name: 'RMC Fuels', area: 'Dinalupihan', initials: 'RM', due: 18000, status: 'collected', method: 'check', amountCollected: 18000, visitedAt: '2026-07-09T09:05:00+08:00', gpsLat: 14.8639, gpsLng: 120.4642 },
  { id: '11111111-1111-4111-8111-000000000003', name: 'Oracle Petroleum (Bataan)', area: 'Mariveles', initials: 'OP', due: 12000, status: 'collected', method: 'gcash', amountCollected: 12000, visitedAt: '2026-07-09T09:28:00+08:00', gpsLat: 14.4333, gpsLng: 120.4833 },
  { id: '11111111-1111-4111-8111-000000000004', name: 'Southgate Trading', area: 'Orani', initials: 'SG', due: 9800, status: 'pending' },
  { id: '11111111-1111-4111-8111-000000000005', name: 'Bayside Mini Mart', area: 'Abucay', initials: 'BM', due: 4300, status: 'pending', onTheWay: true, claimedBy: 'Ador Reyes' },
  { id: '11111111-1111-4111-8111-000000000006', name: 'Northpoint Gas Station', area: 'Hermosa', initials: 'NG', due: 15700, status: 'pending' },
  { id: '11111111-1111-4111-8111-000000000007', name: 'Delta Auto Supply', area: 'Orion', initials: 'DA', due: 7250, status: 'rescheduled', reschedTo: 'Jul 11' },
  { id: '11111111-1111-4111-8111-000000000008', name: 'Camaya Grocers', area: 'Limay', initials: 'CG', due: 5600, status: 'pending' },
];

// One day, one outcome (web 044): a PO is delivered, or failed (= backload,
// with a photo). No follow-up window, no re-listing on the mobile side.
export type DeliveryPoStatus = 'pending' | 'delivered' | 'failed';

export interface DeliveryPo {
  /** UUID string (web `purchase_orders.id`). */
  id: string;
  /** `po_number` — external, printed on the paper PO, deliberately NOT unique. */
  po: string;
  client: string;
  /** Coarser than an address; with the customer name this is the whole listing. No line-items. */
  area: string;
  status: DeliveryPoStatus;
  /** `truck_plate` — per-trip reference. */
  plate?: string;
  /** `sequence_no` — position in the driver's OWN run, assigned at delivery time. */
  seq?: number;
  /** `receiver_name` — optional (customers refuse); the signature is the real proof. */
  receiver?: string;
  signed?: boolean;
  /** `time_in`/`time_out` — real timestamps; both set even on a FAILED stop. */
  timeIn?: string;
  timeOut?: string;
  /** GPS captured with the proof (or backload) photo — delivery HAS GPS now. */
  gpsLat?: number;
  gpsLng?: number;
  /** Backload photo is a capture on a failed row (proof the goods rode back). */
  backloadCaptured?: boolean;
  /** COD is a per-PO toggle, not every delivery. */
  cod: boolean;
  codDue?: number;
  codAmount?: number;
  codMethod?: CodMethod;
  codRemitted?: boolean;
  /**
   * MOCK-ONLY (⚠️ not in web 044 yet): another driver has claimed this pending
   * stop and is en route — shown so nobody double-runs it. Needs a web-side
   * claimed/en-route state to become real (see CollectionStore.onTheWay).
   */
  onTheWay?: boolean;
  claimedBy?: string;
}

export const DELIVERY_POS: DeliveryPo[] = [
  { id: '22222222-2222-4222-8222-000000000001', po: 'PO-2091', client: 'KVR Hardware', area: 'Balanga', status: 'pending', cod: true, codDue: 8200 },
  { id: '22222222-2222-4222-8222-000000000002', po: 'PO-2087', client: 'RMC Fuels', area: 'Dinalupihan', status: 'pending', cod: true, codDue: 15400 },
  { id: '22222222-2222-4222-8222-000000000003', po: 'PO-2093', client: 'Southgate Trading', area: 'Orani', status: 'pending', cod: false, onTheWay: true, claimedBy: 'Ruben Cruz' },
  { id: '22222222-2222-4222-8222-000000000004', po: 'PO-2094', client: 'Bayside Mini Mart', area: 'Abucay', status: 'pending', cod: true, codDue: 3100 },
  { id: '22222222-2222-4222-8222-000000000005', po: 'PO-2085', client: 'MetroTrans Logistics', area: 'Mariveles', status: 'delivered', timeIn: '2026-07-09T08:30:00+08:00', timeOut: '2026-07-09T08:40:00+08:00', receiver: 'J. Ramos', signed: true, plate: 'NGP 4021', seq: 1, gpsLat: 14.4333, gpsLng: 120.4833, cod: false },
  { id: '22222222-2222-4222-8222-000000000006', po: 'PO-2082', client: 'Northpoint Gas Station', area: 'Hermosa', status: 'delivered', timeIn: '2026-07-09T09:00:00+08:00', timeOut: '2026-07-09T09:10:00+08:00', receiver: 'M. dela Cruz', signed: true, plate: 'NGP 4021', seq: 2, gpsLat: 14.8306, gpsLng: 120.5019, cod: true, codDue: 9700, codAmount: 9700, codMethod: 'cash', codRemitted: false },
];

/**
 * Mock mutators for the Collect Payment flow (web `collection_visits`). Update
 * COLLECTION_STORES in place so the dashboard and Today's List decrement.
 * `collector_id` and `gps` would also land here at collection time once wired.
 * Kept in the data lib so screens never mutate a render-scoped value
 * (react-hooks/immutability).
 */
export function markStoreCollected(
  id: string,
  method: PaymentMethod,
  amount: number,
  gps?: { lat: number; lng: number },
  visitedAt: string = new Date().toISOString(),
): void {
  const s = COLLECTION_STORES.find((x) => x.id === id);
  if (s && s.status === 'pending') {
    s.status = 'collected';
    s.method = method;
    s.amountCollected = amount;
    s.visitedAt = visitedAt;
    if (gps) {
      s.gpsLat = gps.lat;
      s.gpsLng = gps.lng;
    }
  }
}

export function rescheduleStore(id: string, to = 'Jul 10'): void {
  const s = COLLECTION_STORES.find((x) => x.id === id);
  if (s && s.status === 'pending') {
    s.status = 'rescheduled';
    s.reschedTo = to;
  }
}

/**
 * Mock mutators for the Deliver PO flow (web `purchase_orders`). ONE OUTCOME
 * model: markPoDelivered or markPoFailed (= backload). No follow-up.
 */
let deliverySeqCounter = 2; // last delivered seq in the mock dataset

export interface DeliverResult {
  plate: string;
  receiver?: string;
  signed: boolean;
  gps?: { lat: number; lng: number };
  codAmount?: number;
  codMethod?: CodMethod;
}

export function markPoDelivered(id: string, result: DeliverResult, at: string = new Date().toISOString()): void {
  const p = DELIVERY_POS.find((x) => x.id === id);
  if (!p || p.status !== 'pending') return;
  p.status = 'delivered';
  p.timeIn = at;
  p.timeOut = at;
  p.plate = result.plate;
  p.receiver = result.receiver && result.receiver.trim() ? result.receiver.trim() : '(walang pangalan — photo proof lang)';
  p.signed = result.signed;
  p.seq = ++deliverySeqCounter;
  if (result.gps) {
    p.gpsLat = result.gps.lat;
    p.gpsLng = result.gps.lng;
  }
  if (p.cod) {
    p.codAmount = result.codAmount;
    p.codMethod = result.codMethod;
    p.codRemitted = false;
  }
}

/** Failed delivery = backload. Requires the backload photo (enforced in the UI). */
export function markPoFailed(id: string, backloadCaptured: boolean, gps?: { lat: number; lng: number }, at: string = new Date().toISOString()): void {
  const p = DELIVERY_POS.find((x) => x.id === id);
  if (!p || p.status !== 'pending') return;
  p.status = 'failed';
  p.timeIn = at;
  p.timeOut = at;
  p.backloadCaptured = backloadCaptured;
  if (gps) {
    p.gpsLat = gps.lat;
    p.gpsLng = gps.lng;
  }
}

// Wireframe c-history `cHist` — gated Collection History rows. Mock only;
// `method` here is display text, so it's unaffected by the lowercase enum.
export type CollectionHistoryResult = 'collected' | 'resched' | 'remitted';

export interface CollectionHistoryEntry {
  store: string;
  date: string;
  amount: number;
  method: string;
  result: CollectionHistoryResult;
}

export const COLLECTION_HISTORY: CollectionHistoryEntry[] = [
  { store: 'KVR Hardware', date: 'Jul 9 · 8:32 AM', amount: 12500, method: 'Cash', result: 'collected' },
  { store: 'RMC Fuels', date: 'Jul 9 · 9:05 AM', amount: 18000, method: 'Check', result: 'collected' },
  { store: 'Oracle Petroleum (Bataan)', date: 'Jul 9 · 9:28 AM', amount: 12000, method: 'GCash', result: 'collected' },
  { store: 'Delta Auto Supply', date: 'Jul 8', amount: 7250, method: '—', result: 'resched' },
  { store: 'Office remittance — Grace V.', date: 'Jul 8 · 5:40 PM', amount: 38750, method: 'Signed proof', result: 'remitted' },
];

export interface RemitReceiver {
  id: number;
  name: string;
  role: string;
  initials: string;
}

/** Office remittance receivers — shared by both roles' Remit screens. */
export const REMIT_RECEIVERS: RemitReceiver[] = [
  { id: 1, name: 'Grace Villanueva', role: 'Cashier — Head Office', initials: 'GV' },
  { id: 2, name: 'Bong Salazar', role: 'Finance Officer', initials: 'BS' },
];

export function formatPeso(n: number): string {
  return `₱${n.toLocaleString('en-PH')}`;
}

/** Compact ₱ for stat cards, e.g. ₱42.5k. */
export function formatPesoCompact(n: number): string {
  return n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : formatPeso(n);
}

export function getCollectionSummary(stores: CollectionStore[] = COLLECTION_STORES) {
  const collected = stores.filter((s) => s.status === 'collected');
  const pending = stores.filter((s) => s.status === 'pending');
  const collectedTotal = collected.reduce((sum, s) => sum + (s.amountCollected ?? s.due), 0);
  return {
    total: stores.length,
    visitedCount: collected.length,
    pendingCount: pending.length,
    collectedTotal,
    // First draft: everything collected today is still on-hand (nothing
    // remitted yet in the mock dataset).
    forRemittance: collectedTotal,
    visitedPct: stores.length === 0 ? 0 : Math.round((collected.length / stores.length) * 100),
  };
}

export function getDeliverySummary(pos: DeliveryPo[] = DELIVERY_POS) {
  const pending = pos.filter((p) => p.status === 'pending');
  const delivered = pos.filter((p) => p.status === 'delivered');
  const failed = pos.filter((p) => p.status === 'failed');
  const codOnHand = pos
    .filter((p) => p.cod && p.status === 'delivered' && !p.codRemitted)
    .reduce((sum, p) => sum + (p.codAmount ?? 0), 0);
  return {
    pendingCount: pending.length,
    deliveredCount: delivered.length,
    // Backloads = failed deliveries (goods that came back). What the delivery
    // dashboard now leads on, in place of the dead follow-up window.
    backloadCount: failed.length,
    codOnHand,
  };
}
