import { supabase } from '../supabase';
import { isNetworkConnectivityError } from '../network-error';
import { readSnapshot } from '../app-lock/session-snapshot';
import type { SQLiteDatabase } from 'expo-sqlite';

// Store Locations Phase 4 push (web migrations 113/114, 2026-08-18): pushes a
// field officer's LOCALLY-set relocation pins up to the server via the
// collector/delivery RPCs, so a set/re-selected pin reaches the admin board and
// — through migration 114's keep-fresh — re-stamps the store's default
// coordinate onto its still-open visits/POs (client_lat/client_lng), which then
// syncs back down onto every officer's map this same pass.
//
// Why a reconciler and not the generic outbox (mirrors lib/sync/additional-acks.ts):
//   * is_current can only be flipped through the SECURITY DEFINER RPCs — a field
//     role has no direct UPDATE policy (migration 113 RLS, deliberate), and the
//     outbox push path does PostgREST upserts, not RPCs.
//   * the server ASSIGNS the row's id + seq (so two offline devices can't both
//     mint "Location 3"). A local optimistic row therefore keeps its own local
//     PK and records the server id in `remote_id` on first push — needed to
//     re-select that saved pin later via set_current_client_location().
//
// A pending local row is one of THREE intents:
//   * local_deleted = 1  → a DELETE (deleteStoreLocation on an already-pushed pin).
//     Call delete_client_location(remote_id) (migration 124), then hard-delete the
//     local tombstone. A never-pushed pin is deleted locally on the spot, so a
//     tombstone always has a remote_id.
//   * remote_id IS NULL  → a NEW pin (addStoreLocation). Call set_client_location,
//     store the returned server id, mark synced.
//   * remote_id present  → an existing saved pin re-selected as current
//     (setCurrentStoreLocation). Call set_current_client_location(remote_id).
//
// area/province/kind now travel on the create (web migration 123 added p_area /
// p_province / p_kind): the field-observed municipality + relocation-vs-branch flag
// reach the admin board and other devices. p_kind='additional_branch' is inserted
// server-side as NON-current (no keep-fresh). Rows are pushed oldest-first (by seq)
// so that, when several were added offline, the newest ends up current server-side.

interface PendingLocationRow {
  id: string;
  client_id: string;
  lat: number;
  lng: number;
  label: string | null;
  area: string | null;
  province: string | null;
  kind: string;
  remote_id: string | null;
  local_deleted: number;
}

/**
 * Best-effort: pushes the signed-in field officer's pending store-location pins.
 * Called from the sync engine BEFORE syncDown (so 114's keep-fresh coordinate is
 * pulled back the same pass) while online. Never throws — a push failure must
 * never fail the enclosing pass; each row simply retries next pass (the RPCs are
 * idempotent for our purposes: a re-pushed create just appends another pin, so
 * we only ever push a create ONCE by gating on remote_id).
 */
export async function pushStoreLocations(db: SQLiteDatabase): Promise<void> {
  const pending = await db.getAllAsync<PendingLocationRow>(
    `SELECT id, client_id, lat, lng, label, area, province, kind, remote_id, local_deleted
       FROM client_locations
      WHERE sync_status = 'pending'
      ORDER BY seq ASC, created_at ASC`
  );
  if (pending.length === 0) return;

  // The RPCs authorize only a C&D field role with the client on their day list
  // (42501 otherwise). Non-field roles never hold pending pins anyway, but gate
  // explicitly so a stray row never spins on a permission error.
  const snapshot = await readSnapshot();
  if (snapshot?.role !== 'collector' && snapshot?.role !== 'delivery') return;

  for (const row of pending) {
    try {
      if (row.local_deleted === 1) {
        // DELETE — remove the server row, then drop the local tombstone. A
        // tombstone is only enqueued for an already-pushed pin, so remote_id is
        // set; guard anyway so a stray row can't spin.
        if (row.remote_id === null) {
          await db.runAsync('DELETE FROM client_locations WHERE id = ?', [row.id]);
          continue;
        }
        const { error } = await supabase.rpc('delete_client_location', {
          p_location_id: row.remote_id,
        });
        if (error) throw error;
        await db.runAsync('DELETE FROM client_locations WHERE id = ?', [row.id]);
      } else if (row.remote_id === null) {
        // NEW pin — server appends the next "Location N" and returns its id.
        const { data, error } = await supabase.rpc('set_client_location', {
          p_client_id: row.client_id,
          p_lat: row.lat,
          p_lng: row.lng,
          p_label: row.label,
          p_area: row.area,
          p_province: row.province,
          p_kind: row.kind,
        });
        if (error) throw error;
        await db.runAsync(
          "UPDATE client_locations SET remote_id = ?, sync_status = 'synced', sync_error = NULL WHERE id = ?",
          [(data as string) ?? null, row.id]
        );
      } else {
        // RE-SELECT — promote an already-saved server pin back to current.
        const { error } = await supabase.rpc('set_current_client_location', {
          p_location_id: row.remote_id,
        });
        if (error) throw error;
        await db.runAsync(
          "UPDATE client_locations SET sync_status = 'synced', sync_error = NULL WHERE id = ?",
          [row.id]
        );
      }
    } catch (err) {
      // Offline / weak signal is the expected case (offline-first) — stay quiet
      // and let the next online pass retry. Surface anything else once; it also
      // just retries next pass (the row stays 'pending').
      if (!isNetworkConnectivityError(err)) {
        console.error('[store-location-push] push failed for', row.id, err);
      }
    }
  }
}
