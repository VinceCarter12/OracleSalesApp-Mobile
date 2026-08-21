import { supabase } from '../supabase';
import { isNetworkConnectivityError } from '../network-error';
import { readSnapshot } from '../app-lock/session-snapshot';
import type { SQLiteDatabase } from 'expo-sqlite';

// Store Locations down-sync (2026-08-21): pulls the field-set relocation pins
// OTHER collectors/drivers set, so a co-worker sees the corrected store location
// — with WHO set it and WHEN — instead of driving to the stale registered spot
// (the whole point of the feature). Web 113's RLS lets a field role read
// client_locations for any client on their board (a collection_visit for a
// collector, a purchase_order for a driver), so a plain select is auto-scoped;
// nothing comes back for other roles, but we gate anyway to skip a needless pull.
//
// Complements the coordinate that already rides down denormalized on the visit/PO
// (web 114 keep-fresh): this brings the pin as a real `field_set` row, restoring
// the "Field pin · set by X" trust signal the denormalized coordinate loses.
//
// Dedup: a row THIS device pushed keeps its own local PK and links to the server
// id via `remote_id`; a co-worker's row is inserted under the server id. Never
// clobbers a still-`pending` local edit (same overwrite-if-synced guard as the
// entity appliers). NOTE: web's client_locations has no area/province/kind yet,
// so those stay local to the setting device (STORE_LOCATIONS_CONTRACT.md) — this
// intentionally does not touch the local area/province columns, and inserted
// remote rows fall back to the table default kind='relocation'. When web adds a
// `kind` column + returns it here, select it and map it on insert/update so a
// co-worker sees an 'additional_branch' as a branch (not a silent relocation).

interface RemoteClientLocation {
  id: string;
  client_id: string;
  seq: number;
  label: string | null;
  lat: number;
  lng: number;
  is_current: boolean;
  source: string;
  set_by: string | null;
  set_by_name: string | null;
  captured_at: string;
  created_at: string;
}

/**
 * Best-effort: mirrors the server's readable client_locations into the local
 * store. Called from the sync engine AFTER syncDown while online. Never throws —
 * a pull/apply failure must not fail the enclosing pass.
 */
export async function syncStoreLocationsDown(db: SQLiteDatabase): Promise<void> {
  // Only the two field roles ever have in-scope pins (RLS). Non-field roles get
  // an empty set — skip the round-trip.
  const snapshot = await readSnapshot();
  if (snapshot?.role !== 'collector' && snapshot?.role !== 'delivery') return;

  let rows: RemoteClientLocation[];
  try {
    const { data, error } = await supabase
      .from('client_locations')
      .select('id, client_id, seq, label, lat, lng, is_current, source, set_by, set_by_name, captured_at, created_at');
    if (error) throw new Error(error.message);
    rows = (data ?? []) as RemoteClientLocation[];
  } catch (err) {
    if (!isNetworkConnectivityError(err)) {
      console.error('[store-location-sync-down] pull failed', err);
    }
    return;
  }

  const now = new Date().toISOString();
  for (const r of rows) {
    try {
      // Match this device's own pushed row (by remote_id) or a previously
      // synced-down row (its PK IS the server id).
      const existing = await db.getFirstAsync<{ id: string; sync_status: string; local_deleted: number }>(
        'SELECT id, sync_status, local_deleted FROM client_locations WHERE remote_id = ? OR id = ? LIMIT 1',
        [r.id, r.id]
      );
      if (existing) {
        // The officer deleted this pin locally (soft tombstone — web has no delete
        // RPC yet, so the server row still returns here). Respect the local delete:
        // don't re-apply or resurrect it, or it would reappear a few seconds after
        // every delete (STORE_LOCATIONS_CONTRACT §delete).
        if (existing.local_deleted === 1) continue;
        // Don't overwrite a pin the officer just set but hasn't pushed yet.
        if (existing.sync_status !== 'synced') continue;
        await db.runAsync(
          `UPDATE client_locations SET
             client_id = ?, seq = ?, label = ?, lat = ?, lng = ?, is_current = ?,
             source = ?, set_by = ?, set_by_name = ?, captured_at = ?,
             remote_id = ?, sync_status = 'synced', sync_error = NULL, local_updated_at = ?
           WHERE id = ?`,
          [r.client_id, r.seq, r.label, r.lat, r.lng, r.is_current ? 1 : 0, r.source,
            r.set_by, r.set_by_name, r.captured_at, r.id, now, existing.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO client_locations
             (id, client_id, seq, label, lat, lng, is_current, source, set_by, set_by_name,
              captured_at, created_at, local_updated_at, sync_status, remote_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          [r.id, r.client_id, r.seq, r.label, r.lat, r.lng, r.is_current ? 1 : 0, r.source,
            r.set_by, r.set_by_name, r.captured_at, r.created_at, now, r.id]
        );
      }
    } catch (err) {
      console.error(`[store-location-sync-down] apply failed for ${r.id}`, err);
    }
  }
}
