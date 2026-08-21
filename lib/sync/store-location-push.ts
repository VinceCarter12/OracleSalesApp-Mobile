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
// A pending local row is one of two intents, distinguished by remote_id:
//   * remote_id IS NULL  → a NEW pin (addStoreLocation). Call set_client_location,
//     store the returned server id, mark synced.
//   * remote_id present  → an existing saved pin re-selected as current
//     (setCurrentStoreLocation). Call set_current_client_location(remote_id).
//
// LOCAL-ONLY today (web owes RPC params — STORE_LOCATIONS_CONTRACT.md §area+branch):
// `area`, `province`, and `kind` ('relocation' | 'additional_branch') are NOT sent
// — set_client_location currently accepts only (client_id, lat, lng, label), and
// passing extra params would fail PostgREST (PGRST202). Once web adds p_area /
// p_province / p_kind, thread them here so the municipality + branch flag reach
// the admin board and other devices. An 'additional_branch' is pending like any
// pin; when web accepts p_kind it should be inserted server-side as NON-current.
// Rows are pushed oldest-first (by seq) so that, when several were added offline,
// the newest ends up current server-side — matching the local state.

interface PendingLocationRow {
  id: string;
  client_id: string;
  lat: number;
  lng: number;
  label: string | null;
  remote_id: string | null;
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
    `SELECT id, client_id, lat, lng, label, remote_id
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
      if (row.remote_id === null) {
        // NEW pin — server appends the next "Location N" and returns its id.
        const { data, error } = await supabase.rpc('set_client_location', {
          p_client_id: row.client_id,
          p_lat: row.lat,
          p_lng: row.lng,
          p_label: row.label,
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
