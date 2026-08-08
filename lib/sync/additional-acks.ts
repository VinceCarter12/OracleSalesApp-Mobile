import { supabase } from '../supabase';
import { isNetworkConnectivityError } from '../network-error';
import { readSnapshot } from '../app-lock/session-snapshot';
import type { SQLiteDatabase } from 'expo-sqlite';

// F-007 Additional Collection Phase B (web migrations 068/069, 2026-08-08):
// stamps the two acknowledgment timestamps for an "Additional" store back to
// the server, so the admin board can show "Delivered ✓" (the row reached the
// phone) and "Viewed" (the collector opened it).
//
// Why a reconciler and not the outbox: these columns can ONLY be written via
// the collector-only RPCs `mark_additional_received` / `mark_additional_seen`
// — a direct UPDATE is rejected by RLS (migration 069, deliberate), and the
// outbox push path does PostgREST upserts, not RPCs. Both RPCs are write-once
// (COALESCE) and idempotent, so this doesn't need perfect "only once" logic:
// it just re-attempts each online sync pass until the local row reflects the
// stamp.
//
// - RECEIVED is driven purely off `additional_received_at IS NULL`: until the
//   RPC succeeds the value stays null and the next pass retries; no local flag
//   needed. Runs right after sync-down so a freshly-pulled additional row is
//   acknowledged in the same pass.
// - SEEN is driven off the local-only `additional_seen_pending` flag, set when
//   the collector opens the store screen (possibly offline). Cleared only once
//   the RPC lands.

/** The stamped timestamptz the RPCs return (or null if the row wasn't additional server-side). */
type AckRpc = 'mark_additional_received' | 'mark_additional_seen';

async function callAck(fn: AckRpc, visitId: string): Promise<{ ok: boolean; stampedAt: string | null }> {
  try {
    const { data, error } = await supabase.rpc(fn, { p_visit_id: visitId });
    if (error) throw error;
    return { ok: true, stampedAt: (data as string | null) ?? null };
  } catch (err) {
    // Offline / weak signal is the expected case here (offline-first) — stay
    // quiet and let the next online pass retry. A 42501 (non-collector) or any
    // other real error is worth surfacing once; it also just retries next pass.
    if (!isNetworkConnectivityError(err)) {
      console.error(`[additional-acks] ${fn} failed`, err);
    }
    return { ok: false, stampedAt: null };
  }
}

/**
 * Best-effort: reconciles pending Additional-Collection acknowledgments for the
 * signed-in collector. Called from the sync engine AFTER sync-down, while
 * online. Never throws — an ack failure must never fail the enclosing pass.
 */
export async function reconcileAdditionalAcks(db: SQLiteDatabase): Promise<void> {
  const toReceive = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM collection_visits WHERE is_additional = 1 AND additional_received_at IS NULL'
  );
  const toSee = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM collection_visits WHERE is_additional = 1 AND additional_seen_pending = 1'
  );
  if (toReceive.length === 0 && toSee.length === 0) return;

  // The RPCs are collector-only (42501 otherwise). Field-role data scoping
  // means non-collectors shouldn't have additional rows locally anyway, but
  // gate explicitly so a stray row never spins on a permission error.
  const snapshot = await readSnapshot();
  if (snapshot?.role !== 'collector') return;

  for (const { id } of toReceive) {
    const { ok, stampedAt } = await callAck('mark_additional_received', id);
    if (ok && stampedAt) {
      await db.runAsync('UPDATE collection_visits SET additional_received_at = ? WHERE id = ?', [stampedAt, id]);
    }
  }

  for (const { id } of toSee) {
    const { ok, stampedAt } = await callAck('mark_additional_seen', id);
    if (ok) {
      // Clear the local intent even when the server returns null (it decided the
      // row isn't additional) — there's nothing left to retry either way.
      await db.runAsync(
        'UPDATE collection_visits SET additional_seen_at = COALESCE(?, additional_seen_at), additional_seen_pending = 0 WHERE id = ?',
        [stampedAt, id]
      );
    }
  }
}
