import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { subscribeSyncComplete } from './sync/sync-events';

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
