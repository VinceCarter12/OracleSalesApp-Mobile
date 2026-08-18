import { supabase } from '../supabase';
import { classifySyncError, backoffDelayMs, MAX_OUTBOX_ATTEMPTS } from './outbox-status';
import type { SQLiteDatabase } from 'expo-sqlite';

// F-007 per-payment remittance coverage — the LINK PUSH (web 086/087,
// REMITTANCE_CONTRACT.md, 2026-08-18). At remittance submit, remittance-write.ts
// STAGES a link on the covered payments (`pending_remittance_id` /
// `pending_cod_remittance_id`). This lane pushes that link to the server:
//
//   UPDATE collection_payments SET remittance_id = <rid> WHERE id = <pid>
//
// It can't ride the generic outbox — collection_payments/cod_payments aren't
// entity-registry tables (they're insert-queues, no generic update applier).
// And it has an FK dependency: the remittance row must exist server-side before
// a payment can reference it. So each push GATES on the parent remittance being
// locally `sync_status = 'synced'` (its own outbox insert already pushed) — the
// same ordering guard cod-payments.ts uses against its parent PO. Wired into the
// sync pass AFTER processOutbox (which pushes the remittance insert) and BEFORE
// syncDown, so a submit + its links settle in one online pass.
//
// The RLS from 086/087 ("link own payments to remittance": own + unremitted +
// immutable once set) already enforces correctness; the `remittance_id IS NULL`
// filter on the UPDATE just makes a double-push a harmless no-op. On success the
// staged column is cleared onto the authoritative one; sync-down later reconciles
// from the server regardless.

export interface RemittanceLinkSyncResult {
  synced: number;
  failed: number;
}

interface PendingLinkRow {
  id: string;
  link_id: string;
  link_retry_count: number;
}

/**
 * One table's link push. `linkColumn`/`pendingColumn` are the authoritative /
 * staged columns; `parentTable` is the remittance table whose row must be
 * synced first; `ownerColumn` scopes to this agent's own rows.
 */
interface LinkTableConfig {
  table: 'collection_payments' | 'cod_payments';
  linkColumn: 'remittance_id' | 'cod_remittance_id';
  pendingColumn: 'pending_remittance_id' | 'pending_cod_remittance_id';
  parentTable: 'remittances' | 'cod_remittances';
  ownerColumn: 'collector_id' | 'driver_id';
  /**
   * The concrete remote UPDATE — kept per-table (not a dynamic
   * `supabase.from(table).update({ [col]: v })`) so supabase-js resolves a real
   * typed overload instead of collapsing the union to `never`.
   */
  updateRemote: (paymentId: string, linkId: string) => PromiseLike<{ error: { message: string } | null }>;
}

async function pushLinksFor(
  db: SQLiteDatabase,
  agentId: string,
  config: LinkTableConfig,
  result: RemittanceLinkSyncResult,
): Promise<void> {
  const { table, linkColumn, pendingColumn, parentTable, ownerColumn, updateRemote } = config;
  const now = new Date().toISOString();
  const rows = await db.getAllAsync<PendingLinkRow>(
    `SELECT p.id AS id, p.${pendingColumn} AS link_id, p.link_retry_count AS link_retry_count
       FROM ${table} p
       JOIN ${parentTable} r ON r.id = p.${pendingColumn}
      WHERE p.${ownerColumn} = ?
        AND p.${pendingColumn} IS NOT NULL AND p.${linkColumn} IS NULL
        AND r.sync_status = 'synced'
        AND (p.link_next_attempt_at IS NULL OR p.link_next_attempt_at <= ?)
      ORDER BY p.created_at ASC`,
    [agentId, now],
  );

  for (const row of rows) {
    try {
      const { error } = await updateRemote(row.id, row.link_id);
      if (error) throw error;

      // Promote the staged link to authoritative locally so on-hand drops it and
      // this row isn't re-selected. sync-down re-confirms it from the server.
      await db.runAsync(
        `UPDATE ${table} SET ${linkColumn} = ${pendingColumn}, ${pendingColumn} = NULL, link_error = NULL WHERE id = ?`,
        [row.id],
      );
      result.synced++;
    } catch (err) {
      const classified = classifySyncError(err);
      if (classified.kind === 'transient') {
        const nextRetry = row.link_retry_count + 1;
        if (nextRetry < MAX_OUTBOX_ATTEMPTS) {
          const nextAt = new Date(Date.now() + backoffDelayMs(nextRetry)).toISOString();
          await db.runAsync(
            `UPDATE ${table} SET link_retry_count = ?, link_next_attempt_at = ?, link_error = ? WHERE id = ?`,
            [nextRetry, nextAt, classified.message, row.id],
          );
        } else {
          await db.runAsync(`UPDATE ${table} SET link_retry_count = ?, link_error = ? WHERE id = ?`, [
            nextRetry,
            classified.message,
            row.id,
          ]);
          result.failed++;
        }
      } else {
        // permanent (RLS denial, bad payload) — record the error and stop
        // retrying this row. It stays excluded from on-hand (pending link set),
        // so it can't be silently double-remitted while flagged.
        await db.runAsync(`UPDATE ${table} SET link_error = ? WHERE id = ?`, [classified.message, row.id]);
        result.failed++;
      }
    }
  }
}

/**
 * Pushes every staged remittance link (collection + COD) whose parent remittance
 * has already synced. Best-effort per row: one bad row never blocks the rest.
 */
export async function processRemittanceLinks(db: SQLiteDatabase, agentId: string): Promise<RemittanceLinkSyncResult> {
  const result: RemittanceLinkSyncResult = { synced: 0, failed: 0 };
  try {
    await pushLinksFor(
      db,
      agentId,
      {
        table: 'collection_payments',
        linkColumn: 'remittance_id',
        pendingColumn: 'pending_remittance_id',
        parentTable: 'remittances',
        ownerColumn: 'collector_id',
        updateRemote: (paymentId, linkId) =>
          supabase.from('collection_payments').update({ remittance_id: linkId }).eq('id', paymentId).is('remittance_id', null),
      },
      result,
    );
  } catch (err) {
    console.error('[remittance-link] collection link push failed', err);
  }
  try {
    await pushLinksFor(
      db,
      agentId,
      {
        table: 'cod_payments',
        linkColumn: 'cod_remittance_id',
        pendingColumn: 'pending_cod_remittance_id',
        parentTable: 'cod_remittances',
        ownerColumn: 'driver_id',
        updateRemote: (paymentId, linkId) =>
          supabase.from('cod_payments').update({ cod_remittance_id: linkId }).eq('id', paymentId).is('cod_remittance_id', null),
      },
      result,
    );
  } catch (err) {
    console.error('[remittance-link] cod link push failed', err);
  }
  return result;
}
