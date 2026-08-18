import { useCallback, useEffect, useState } from 'react';
import { getDb } from './db';
import { subscribeSyncComplete } from './sync/sync-events';
import { resolveStoreLocation, type StoreLocationOrigin } from './store-location-resolver';

// Store Locations (C&D maps, 2026-08-17): turns the day's list of stores into
// map-ready coordinates. For each store it runs the precedence resolver
// (current client_locations pin → client office pin → visit/PO GPS) against the
// LOCAL mirror, so it works offline and reflects a location the officer just set
// on this device. Stores with no coordinate at all fall into `unlocated` so the
// screen can show a "location not set" bucket instead of silently dropping them.
//
// ⚠️ The office-pin fallback reads `clients.office_lat/office_lng` from the local
// mirror. If field-role devices don't sync those `clients` rows (the open
// dependency in STORE_LOCATIONS_CONTRACT.md), that fallback is simply empty and
// the store lands in `unlocated` until someone sets a field pin — no crash.

export interface MapStoreInput {
  id: string;
  clientId?: string;
  name: string;
  area: string;
  initials: string;
  gpsLat?: number;
  gpsLng?: number;
}

export interface LocatedStore extends MapStoreInput {
  lat: number;
  lng: number;
  origin: StoreLocationOrigin;
}

interface ClientPinRow {
  id: string;
  office_lat: number | null;
  office_lng: number | null;
}

interface CurrentLocationRow {
  client_id: string;
  lat: number;
  lng: number;
}

/** A change to any of these per-store fields must re-run the resolve. */
function storesKey(stores: MapStoreInput[]): string {
  return stores.map((s) => `${s.id}:${s.clientId ?? ''}:${s.gpsLat ?? ''}:${s.gpsLng ?? ''}`).join('|');
}

async function resolveStores(stores: MapStoreInput[]): Promise<{ located: LocatedStore[]; unlocated: MapStoreInput[] }> {
  const clientIds = Array.from(new Set(stores.map((s) => s.clientId).filter((id): id is string => !!id)));

  const officePins = new Map<string, { lat: number; lng: number }>();
  const currentLocations = new Map<string, { lat: number; lng: number }>();

  if (clientIds.length > 0) {
    const db = await getDb();
    const placeholders = clientIds.map(() => '?').join(',');
    const clientRows = await db.getAllAsync<ClientPinRow>(
      `SELECT id, office_lat, office_lng FROM clients WHERE id IN (${placeholders})`,
      clientIds
    );
    for (const r of clientRows) {
      if (r.office_lat != null && r.office_lng != null) {
        officePins.set(r.id, { lat: r.office_lat, lng: r.office_lng });
      }
    }
    const locRows = await db.getAllAsync<CurrentLocationRow>(
      `SELECT client_id, lat, lng FROM client_locations WHERE is_current = 1 AND client_id IN (${placeholders})`,
      clientIds
    );
    for (const r of locRows) currentLocations.set(r.client_id, { lat: r.lat, lng: r.lng });
  }

  const located: LocatedStore[] = [];
  const unlocated: MapStoreInput[] = [];
  for (const s of stores) {
    const resolved = resolveStoreLocation({
      currentLocation: s.clientId ? currentLocations.get(s.clientId) : undefined,
      officePin: s.clientId ? officePins.get(s.clientId) : undefined,
      visitGps: s.gpsLat != null && s.gpsLng != null ? { lat: s.gpsLat, lng: s.gpsLng } : undefined,
    });
    if (resolved) located.push({ ...s, ...resolved });
    else unlocated.push(s);
  }
  return { located, unlocated };
}

export function useStoreLocationMap(stores: MapStoreInput[]) {
  const [located, setLocated] = useState<LocatedStore[]>([]);
  const [unlocated, setUnlocated] = useState<MapStoreInput[]>([]);
  const [loading, setLoading] = useState(true);
  // Manual/sync-driven re-run trigger — bumping this re-runs the effect below
  // without needing to hold `stores` in a render-time ref.
  const [tick, setTick] = useState(0);

  // `key` re-runs the effect only when the meaningful per-store content changes
  // (the parent passes a freshly filtered array every render, which would
  // otherwise loop). `stores` is read live inside the effect.
  const key = storesKey(stores);

  useEffect(() => {
    let cancelled = false;
    resolveStores(stores).then((result) => {
      if (cancelled) return;
      setLocated(result.located);
      setUnlocated(result.unlocated);
      setLoading(false);
    });
    // Re-resolve after a background sync-down (once client_locations / clients sync).
    const unsubscribe = subscribeSyncComplete(() => setTick((t) => t + 1));
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // `stores` is intentionally read through `key` (a content hash) + `tick`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { located, unlocated, loading, refresh };
}
