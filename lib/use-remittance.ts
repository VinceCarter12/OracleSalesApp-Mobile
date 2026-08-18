import { useCallback, useEffect, useState } from 'react';
import { useAppDb } from './app-db-provider';
import { subscribeSyncComplete } from './sync/sync-events';
import type { RemitDestination } from './remittance-write';

// F-007 remittances READ side (2026-07-29): computes "on hand" from the synced
// local mirror, not mock arrays. Both re-fetch on sync-complete, mirroring
// use-collection-delivery.ts.
//
// 2026-08-18 — PER-PAYMENT coverage (web 086/087, REMITTANCE_CONTRACT.md). On
// hand is now the sum of the collector's/driver's own PAYMENTS not yet covered
// by a remittance, read from the synced-down payment ledger
// (lib/sync/payment-ledger-sync-down.ts): a payment is on hand ⇔ its link is
// NULL. This replaces the old per-VISIT/per-PO scan, which stranded a later
// installment on an already-remitted partial visit/PO (the id was frozen in a
// past remittance's visit_ids/po_ids). Coverage is per handover now, so a
// top-up on a previously-remitted visit is a fresh, still-on-hand payment.
//
// Only `status = 'synced'` payments count: a payment can't be remitted until it
// exists server-side (the link is pushed via an UPDATE — lib/sync/
// remittance-link.ts), and a not-yet-pushed row is also not yet rolled up onto
// its visit/PO, so this matches the cash the collector can actually hand over.
// A payment with a locally-staged link (`pending_*_remittance_id`) is excluded
// the moment it's staked to a remittance, so it can't be double-remitted.

export interface OnHandSummary {
  /** Total peso amount on hand (sum across all methods). */
  total: number;
  /** Per-method breakdown for the badges. `counter` (collection) is folded into `total` but not shown as its own badge. */
  byMethod: { cash: number; check: number; gcash: number };
  /** Number of payments making up the total. */
  count: number;
  /** The PAYMENT ids this remittance would cover — passed straight to the write, which links each to the new remittance. */
  ids: string[];
}

function emptySummary(): OnHandSummary {
  return { total: 0, byMethod: { cash: 0, check: 0, gcash: 0 }, count: 0, ids: [] };
}

interface PaymentRow {
  id: string;
  amount: number | null;
  payment_method: string | null;
}

/** Collection "collections on hand" — this collector's own synced payments not yet linked to (or staged for) a remittance. */
export function useCollectionOnHand(collectorId: string | null | undefined) {
  const db = useAppDb();
  const [summary, setSummary] = useState<OnHandSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!collectorId) {
      setSummary(emptySummary());
      setLoading(false);
      return;
    }
    const payments = await db.getAllAsync<PaymentRow>(
      `SELECT id, amount, payment_method FROM collection_payments
       WHERE collector_id = ? AND status = 'synced'
         AND remittance_id IS NULL AND pending_remittance_id IS NULL`,
      [collectorId],
    );

    const next = emptySummary();
    for (const row of payments) {
      const amount = row.amount ?? 0;
      next.total += amount;
      next.count += 1;
      next.ids.push(row.id);
      if (row.payment_method === 'cash') next.byMethod.cash += amount;
      else if (row.payment_method === 'check') next.byMethod.check += amount;
      else if (row.payment_method === 'gcash') next.byMethod.gcash += amount;
    }
    setSummary(next);
    setLoading(false);
  }, [db, collectorId]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { summary, loading, refresh: fetch };
}

// F-007 remittance HISTORY (2026-08-04): the list of remittances this
// collector/driver has already submitted, read straight from the synced local
// mirror (remittances / cod_remittances). `sync_status` distinguishes a row
// that's still riding the outbox ('pending') from one confirmed on the server
// ('synced'), so the screen can honestly show "Syncing…" vs "Submitted". Newest
// first — a submitted_at written at submit time, falling back to created_at.

/** One submitted collection remittance, shaped for the history screen. */
export interface RemittanceHistoryEntry {
  id: string;
  destination: RemitDestination;
  amountRemitted: number;
  amountCollected: number;
  receiverName: string | null;
  submittedAt: string | null;
  status: string;
  /** How many collection visits this remittance covered (from visit_ids). */
  visitCount: number;
  /** True once the server confirmed the row (sync_status='synced'). */
  synced: boolean;
}

interface RemittanceHistoryRow {
  id: string;
  destination: string;
  amount_remitted: number | null;
  amount_collected: number | null;
  receiver_name: string | null;
  submitted_at: string | null;
  status: string | null;
  visit_ids: string | null;
  sync_status: string | null;
}

/** Count the ids in a JSON-text `visit_ids`/`po_ids` column; 0 on malformed. */
function countIds(json: string | null): number {
  if (!json) return 0;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

/** Collection remittance history — this collector's submitted `remittances`, newest first. */
export function useRemittanceHistory(collectorId: string | null | undefined) {
  const db = useAppDb();
  const [entries, setEntries] = useState<RemittanceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!collectorId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const rows = await db.getAllAsync<RemittanceHistoryRow>(
      `SELECT id, destination, amount_remitted, amount_collected, receiver_name,
              submitted_at, status, visit_ids, sync_status
       FROM remittances WHERE collector_id = ?
       ORDER BY COALESCE(submitted_at, created_at) DESC`,
      [collectorId],
    );
    setEntries(
      rows.map((r) => ({
        id: r.id,
        destination: (r.destination as RemitDestination) ?? 'office',
        amountRemitted: r.amount_remitted ?? 0,
        amountCollected: r.amount_collected ?? 0,
        receiverName: r.receiver_name,
        submittedAt: r.submitted_at,
        status: r.status ?? 'submitted',
        visitCount: countIds(r.visit_ids),
        synced: r.sync_status === 'synced',
      })),
    );
    setLoading(false);
  }, [db, collectorId]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { entries, loading, refresh: fetch };
}

/** One submitted COD delivery remittance, shaped for the history screen. */
export interface CodRemittanceHistoryEntry {
  id: string;
  amountRemitted: number;
  amountCollected: number;
  receiverName: string;
  submittedAt: string | null;
  status: string;
  /** How many delivered COD POs this remittance covered (from po_ids). */
  poCount: number;
  synced: boolean;
}

interface CodRemittanceHistoryRow {
  id: string;
  amount_remitted: number | null;
  amount_collected: number | null;
  receiver_name: string | null;
  submitted_at: string | null;
  status: string | null;
  po_ids: string | null;
  sync_status: string | null;
}

/** COD remittance history — this driver's submitted `cod_remittances`, newest first. */
export function useCodRemittanceHistory(driverId: string | null | undefined) {
  const db = useAppDb();
  const [entries, setEntries] = useState<CodRemittanceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!driverId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const rows = await db.getAllAsync<CodRemittanceHistoryRow>(
      `SELECT id, amount_remitted, amount_collected, receiver_name,
              submitted_at, status, po_ids, sync_status
       FROM cod_remittances WHERE driver_id = ?
       ORDER BY COALESCE(submitted_at, created_at) DESC`,
      [driverId],
    );
    setEntries(
      rows.map((r) => ({
        id: r.id,
        amountRemitted: r.amount_remitted ?? 0,
        amountCollected: r.amount_collected ?? 0,
        receiverName: r.receiver_name ?? '',
        submittedAt: r.submitted_at,
        status: r.status ?? 'submitted',
        poCount: countIds(r.po_ids),
        synced: r.sync_status === 'synced',
      })),
    );
    setLoading(false);
  }, [db, driverId]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { entries, loading, refresh: fetch };
}

/** COD "on hand" — this driver's own synced COD payments not yet linked to (or staged for) a COD remittance. */
export function useCodOnHand(driverId: string | null | undefined) {
  const db = useAppDb();
  const [summary, setSummary] = useState<OnHandSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!driverId) {
      setSummary(emptySummary());
      setLoading(false);
      return;
    }
    const payments = await db.getAllAsync<PaymentRow>(
      `SELECT id, amount, payment_method FROM cod_payments
       WHERE driver_id = ? AND status = 'synced'
         AND cod_remittance_id IS NULL AND pending_cod_remittance_id IS NULL`,
      [driverId],
    );
    const next = emptySummary();
    for (const row of payments) {
      const amount = row.amount ?? 0;
      next.total += amount;
      next.count += 1;
      next.ids.push(row.id);
      if (row.payment_method === 'cash') next.byMethod.cash += amount;
      else if (row.payment_method === 'check') next.byMethod.check += amount;
      else if (row.payment_method === 'gcash') next.byMethod.gcash += amount;
    }
    setSummary(next);
    setLoading(false);
  }, [db, driverId]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { summary, loading, refresh: fetch };
}
