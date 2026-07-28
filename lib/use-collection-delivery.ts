import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { subscribeSyncComplete } from './sync/sync-events';
import {
  rowToPo,
  rowToStore,
  type LocalCollectionVisitRow,
  type LocalPurchaseOrderRow,
} from './local-collection-delivery-mapper';
import type { CollectionStore, DeliveryPo } from './collection-delivery-data';

// F-007 Phase 1 (2026-07-28): read the day's Collection/Delivery lists from the
// local SQLite mirror (populated by syncDown, web 043-046). Mirrors
// lib/useClients.ts exactly — fetch on mount + re-fetch on sync-complete so a
// background pull right after login lands on screen without a manual refresh.
// Field roles pull the WHOLE day's list (RLS-scoped), so there's no per-user
// filter here.

export function useCollectionStores() {
  const db = useSQLiteContext();
  const [stores, setStores] = useState<CollectionStore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const rows = await db.getAllAsync<LocalCollectionVisitRow>(
      'SELECT * FROM collection_visits ORDER BY scheduled_for DESC, created_at DESC'
    );
    setStores(rows.map(rowToStore));
    setLoading(false);
  }, [db]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { stores, loading, refresh: fetch };
}

export function useDeliveryPos() {
  const db = useSQLiteContext();
  const [pos, setPos] = useState<DeliveryPo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const rows = await db.getAllAsync<LocalPurchaseOrderRow>(
      'SELECT * FROM purchase_orders ORDER BY scheduled_for DESC, created_at DESC'
    );
    setPos(rows.map(rowToPo));
    setLoading(false);
  }, [db]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { pos, loading, refresh: fetch };
}

/** Single collection visit by id — for the Collect Payment screen's display. */
export function useCollectionStore(id: string | undefined) {
  const db = useSQLiteContext();
  const [store, setStore] = useState<CollectionStore | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!id) {
      setStore(null);
      setLoading(false);
      return;
    }
    const row = await db.getFirstAsync<LocalCollectionVisitRow>(
      'SELECT * FROM collection_visits WHERE id = ?',
      [id]
    );
    setStore(row ? rowToStore(row) : null);
    setLoading(false);
  }, [db, id]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { store, loading };
}

/** Single purchase order by id — for the Deliver PO screen's display. */
export function useDeliveryPo(id: string | undefined) {
  const db = useSQLiteContext();
  const [po, setPo] = useState<DeliveryPo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!id) {
      setPo(null);
      setLoading(false);
      return;
    }
    const row = await db.getFirstAsync<LocalPurchaseOrderRow>(
      'SELECT * FROM purchase_orders WHERE id = ?',
      [id]
    );
    setPo(row ? rowToPo(row) : null);
    setLoading(false);
  }, [db, id]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { po, loading };
}
