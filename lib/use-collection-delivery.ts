import { useCallback, useEffect, useState } from 'react';
import { useAppDb } from './app-db-provider';
import { subscribeSyncComplete } from './sync/sync-events';
import {
  rowToPo,
  rowToStore,
  type LocalCollectionVisitRow,
  type LocalPurchaseOrderRow,
} from './local-collection-delivery-mapper';
import type { CollectionStore, DeliveryPo } from './collection-delivery-data';

// Store Locations (2026-08-20): joins the municipality + province a field officer
// PICKED on the store's CURRENT relocation pin (client_locations) onto each visit/PO
// row, as `current_location_area` / `current_location_province`. Correlated
// subqueries (not a JOIN) keep `<t>.*` clean of the client_locations columns and
// their id collision. rowToStore/rowToPo prefer these over the sales-agent-set
// `area` (+ the hardcoded ", Bataan") so a relocated store's header reads its real
// area and province. `t` is the visit/PO table alias in the enclosing query.
const CURRENT_LOCATION_COLUMNS = (t: string): string =>
  `(SELECT cl.area FROM client_locations cl WHERE cl.client_id = ${t}.client_id AND cl.is_current = 1 LIMIT 1) AS current_location_area, ` +
  `(SELECT cl.province FROM client_locations cl WHERE cl.client_id = ${t}.client_id AND cl.is_current = 1 LIMIT 1) AS current_location_province`;

// F-007 Phase 1 (2026-07-28): read the day's Collection/Delivery lists from the
// local SQLite mirror (populated by syncDown, web 043-046). Mirrors
// lib/useClients.ts exactly — fetch on mount + re-fetch on sync-complete so a
// background pull right after login lands on screen without a manual refresh.
// Field roles pull the WHOLE day's list (RLS-scoped), so there's no per-user
// filter here.

export function useCollectionStores() {
  const db = useAppDb();
  const [stores, setStores] = useState<CollectionStore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const rows = await db.getAllAsync<LocalCollectionVisitRow>(
      `SELECT cv.*, ${CURRENT_LOCATION_COLUMNS('cv')}
         FROM collection_visits cv
        ORDER BY cv.scheduled_for DESC, cv.created_at DESC`
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
  const db = useAppDb();
  const [pos, setPos] = useState<DeliveryPo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const rows = await db.getAllAsync<LocalPurchaseOrderRow>(
      `SELECT po.*, ${CURRENT_LOCATION_COLUMNS('po')}
         FROM purchase_orders po
        ORDER BY po.scheduled_for DESC, po.created_at DESC`
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
  const db = useAppDb();
  const [store, setStore] = useState<CollectionStore | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!id) {
      setStore(null);
      setLoading(false);
      return;
    }
    const row = await db.getFirstAsync<LocalCollectionVisitRow>(
      `SELECT cv.*, ${CURRENT_LOCATION_COLUMNS('cv')} FROM collection_visits cv WHERE cv.id = ?`,
      [id]
    );
    setStore(row ? rowToStore(row) : null);
    setLoading(false);
  }, [db, id]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { store, loading, refresh: fetch };
}

/** Single purchase order by id — for the Deliver PO screen's display. */
export function useDeliveryPo(id: string | undefined) {
  const db = useAppDb();
  const [po, setPo] = useState<DeliveryPo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!id) {
      setPo(null);
      setLoading(false);
      return;
    }
    const row = await db.getFirstAsync<LocalPurchaseOrderRow>(
      `SELECT po.*, ${CURRENT_LOCATION_COLUMNS('po')} FROM purchase_orders po WHERE po.id = ?`,
      [id]
    );
    setPo(row ? rowToPo(row) : null);
    setLoading(false);
  }, [db, id]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { po, loading, refresh: fetch };
}
