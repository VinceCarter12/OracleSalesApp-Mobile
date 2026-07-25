// F-007 first draft (2026-07-25): mock data for the Collection & Delivery
// dashboards, mirroring Wireframe-Collection-Delivery-BizLink.html's demo
// datasets exactly. No SQLite/Supabase schema exists yet for this module
// (Database.md "Planned schema notes — F-007") — when it lands, these arrays
// get replaced by local-DB reads the same way clients/meetings work today.

export type CollectionStoreStatus = 'pending' | 'collected' | 'resched';
export type PaymentMethod = 'Cash' | 'Check' | 'GCash';

export interface CollectionStore {
  id: number;
  name: string;
  area: string;
  initials: string;
  /** Owed amount — kept in the data model but NEVER shown on the Collect
   * Payment entry screen (2026-07-25 anchoring-bias decision). Dashboard
   * aggregates may still sum it for collected totals. */
  due: number;
  status: CollectionStoreStatus;
  method?: PaymentMethod;
  time?: string;
  reschedTo?: string;
}

export const COLLECTION_STORES: CollectionStore[] = [
  { id: 1, name: 'KVR Hardware', area: 'Balanga', initials: 'KV', due: 12500, status: 'collected', method: 'Cash', time: '8:32 AM' },
  { id: 2, name: 'RMC Fuels', area: 'Dinalupihan', initials: 'RM', due: 18000, status: 'collected', method: 'Check', time: '9:05 AM' },
  { id: 3, name: 'Oracle Petroleum (Bataan)', area: 'Mariveles', initials: 'OP', due: 12000, status: 'collected', method: 'GCash', time: '9:28 AM' },
  { id: 4, name: 'Southgate Trading', area: 'Orani', initials: 'SG', due: 9800, status: 'pending' },
  { id: 5, name: 'Bayside Mini Mart', area: 'Abucay', initials: 'BM', due: 4300, status: 'pending' },
  { id: 6, name: 'Northpoint Gas Station', area: 'Hermosa', initials: 'NG', due: 15700, status: 'pending' },
  { id: 7, name: 'Delta Auto Supply', area: 'Orion', initials: 'DA', due: 7250, status: 'resched', reschedTo: 'Jul 11' },
  { id: 8, name: 'Camaya Grocers', area: 'Limay', initials: 'CG', due: 5600, status: 'pending' },
];

// 'backload' is terminal — no follow-up countdown, driver can't re-open
// (Meeting-2026-07-25 Addendum 2). Only 'failed'/'followup' counts down.
export type DeliveryPoStatus = 'pending' | 'followup' | 'delivered' | 'backload';

export interface DeliveryPo {
  id: number;
  po: string;
  client: string;
  area: string;
  items: string;
  status: DeliveryPoStatus;
  /** Follow-up day (1–3) — 'followup' status only, never on backload. */
  day?: number;
  time?: string;
  receiver?: string;
  plate?: string;
  /** Actual visit order, assigned at delivery time — not pre-planned (2026-07-25). */
  seq?: number;
  /** COD is a per-PO toggle, not every delivery (2026-07-25 addendum). */
  cod: boolean;
  codDue?: number;
  codAmount?: number;
  codMethod?: PaymentMethod;
  codRemitted?: boolean;
}

export const DELIVERY_POS: DeliveryPo[] = [
  { id: 1, po: 'PO-2091', client: 'KVR Hardware', area: 'Balanga', items: '12 × Engine Oil 1L · 4 × Gear Oil 500ml', status: 'pending', cod: true, codDue: 8200 },
  { id: 2, po: 'PO-2087', client: 'RMC Fuels', area: 'Dinalupihan', items: '4 drums · Diesel additive', status: 'followup', day: 2, cod: true, codDue: 15400 },
  { id: 3, po: 'PO-2093', client: 'Southgate Trading', area: 'Orani', items: '6 × Hydraulic Oil 4L', status: 'pending', cod: false },
  { id: 4, po: 'PO-2094', client: 'Bayside Mini Mart', area: 'Abucay', items: '2 boxes · Grease tubs', status: 'pending', cod: true, codDue: 3100 },
  { id: 5, po: 'PO-2085', client: 'MetroTrans Logistics', area: 'Mariveles', items: '20 × Gear Oil 1L', status: 'delivered', time: '8:40 AM', receiver: 'J. Ramos', plate: 'NGP 4021', seq: 1, cod: false },
  { id: 6, po: 'PO-2082', client: 'Northpoint Gas Station', area: 'Hermosa', items: '8 × Engine Oil 4L', status: 'delivered', time: '9:10 AM', receiver: 'M. dela Cruz', plate: 'NGP 4021', seq: 2, cod: true, codDue: 9700, codAmount: 9700, codMethod: 'Cash', codRemitted: false },
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
  const collectedTotal = collected.reduce((sum, s) => sum + s.due, 0);
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
  const undelivered = pos.filter((p) => p.status === 'pending' || p.status === 'followup');
  const followUps = pos.filter((p) => p.status === 'followup');
  const codOnHand = pos
    .filter((p) => p.cod && p.status === 'delivered' && !p.codRemitted)
    .reduce((sum, p) => sum + (p.codAmount ?? 0), 0);
  return {
    pendingCount: undelivered.length,
    followUpCount: followUps.length,
    followUpDay: followUps[0]?.day ?? null,
    followUpPo: followUps[0]?.po ?? null,
    codOnHand,
  };
}
