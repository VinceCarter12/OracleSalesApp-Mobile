import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { subscribeSyncComplete } from './sync/sync-events';
import type { RemitDestination } from './remittance-write';

// F-007 remittances READ side (2026-07-29): computes "on hand" from the synced
// local mirror, not mock arrays. Collection on-hand = this collector's collected
// visits not yet covered by any remittance (visit_ids); COD on-hand = this
// driver's delivered COD POs with cod_remitted still 0. Both re-fetch on
// sync-complete, mirroring use-collection-delivery.ts.

export interface OnHandSummary {
  /** Total peso amount on hand (sum across all methods). */
  total: number;
  /** Per-method breakdown for the badges. `counter` (collection) is folded into `total` but not shown as its own badge. */
  byMethod: { cash: number; check: number; gcash: number };
  /** Number of stops/POs making up the total. */
  count: number;
  /** The visit/PO ids this remittance would cover — passed straight to the write. */
  ids: string[];
}

function emptySummary(): OnHandSummary {
  return { total: 0, byMethod: { cash: 0, check: 0, gcash: 0 }, count: 0, ids: [] };
}

interface CollectedRow {
  id: string;
  amount_collected: number | null;
  payment_method: string | null;
}

/** Collection "collections on hand" — collected visits by this collector not yet in a remittance. */
export function useCollectionOnHand(collectorId: string | null | undefined) {
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<OnHandSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!collectorId) {
      setSummary(emptySummary());
      setLoading(false);
      return;
    }
    const collected = await db.getAllAsync<CollectedRow>(
      `SELECT id, amount_collected, payment_method FROM collection_visits
       WHERE status = 'collected' AND collector_id = ?`,
      [collectorId],
    );
    const remittances = await db.getAllAsync<{ visit_ids: string }>(
      'SELECT visit_ids FROM remittances WHERE collector_id = ?',
      [collectorId],
    );
    const remitted = new Set<string>();
    for (const r of remittances) {
      try {
        for (const id of JSON.parse(r.visit_ids) as string[]) remitted.add(id);
      } catch {
        // Malformed JSON in a mirror row — skip it rather than break the tally.
      }
    }

    const next = emptySummary();
    for (const row of collected) {
      if (remitted.has(row.id)) continue;
      const amount = row.amount_collected ?? 0;
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
  const db = useSQLiteContext();
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
  const db = useSQLiteContext();
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

interface CodRow {
  id: string;
  cod_amount: number | null;
  cod_method: string | null;
}

/** COD "on hand" — delivered COD POs by this driver not yet remitted (cod_remitted = 0). */
export function useCodOnHand(driverId: string | null | undefined) {
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<OnHandSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!driverId) {
      setSummary(emptySummary());
      setLoading(false);
      return;
    }
    const rows = await db.getAllAsync<CodRow>(
      `SELECT id, cod_amount, cod_method FROM purchase_orders
       WHERE status = 'delivered' AND cod = 1 AND cod_remitted = 0 AND driver_id = ?`,
      [driverId],
    );
    const next = emptySummary();
    for (const row of rows) {
      const amount = row.cod_amount ?? 0;
      next.total += amount;
      next.count += 1;
      next.ids.push(row.id);
      if (row.cod_method === 'cash') next.byMethod.cash += amount;
      else if (row.cod_method === 'check') next.byMethod.check += amount;
      else if (row.cod_method === 'gcash') next.byMethod.gcash += amount;
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
