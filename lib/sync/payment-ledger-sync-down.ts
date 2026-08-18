import { supabase } from '../supabase';
import { withTimeout } from '../with-timeout';
import type { SQLiteDatabase } from 'expo-sqlite';

// F-007 per-payment remittance coverage — the PULL half (web 086/087,
// REMITTANCE_CONTRACT.md, 2026-08-18). Until now `collection_payments` /
// `cod_payments` existed on the phone ONLY as outgoing insert queues
// (lib/sync/collection-payments.ts / cod-payments.ts). Per-payment on-hand
// needs the phone to actually READ the ledger back: which of the collector's/
// driver's payments the server considers remitted (`remittance_id` /
// `cod_remittance_id` set) versus still on hand (link NULL).
//
// This is a narrow, own-rows-only pull (migrations 070/073 grant "read own
// payments" SELECT RLS; 086/087 expose the link column), NOT routed through the
// entity registry — these tables carry local-only outbox bookkeeping
// (status/retry_count/photo uris, and the link-push columns) that a generic
// full-row upsert would clobber. So the upsert below touches ONLY the
// server-authoritative columns and, on conflict, ONLY re-stamps the
// authoritative link — leaving every local column (including a staged
// `pending_*_remittance_id`) untouched.
//
// Rows this device created are already present locally with status='synced'
// after their insert landed, so they hit the ON CONFLICT path (link re-stamp
// only). Rows not present locally (fresh reinstall / new device) are inserted
// with status='synced' — the insert lane already completed server-side, so the
// local-only insert columns (photo uris etc.) are irrelevant.

const SYNC_TIMEOUT_MS = 15000;

interface RemoteCollectionPaymentRow {
  id: string;
  visit_id: string;
  collector_id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  created_at: string;
  remittance_id: string | null;
}

interface RemoteCodPaymentRow {
  id: string;
  po_id: string;
  driver_id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  created_at: string;
  cod_remittance_id: string | null;
}

async function pullCollectionPaymentLedger(db: SQLiteDatabase, agentId: string): Promise<void> {
  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase
        .from('collection_payments')
        .select('id, visit_id, collector_id, amount, payment_method, paid_at, created_at, remittance_id')
        .eq('collector_id', agentId),
    ),
    SYNC_TIMEOUT_MS,
    'sync-down collection_payments',
  );
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = raw as RemoteCollectionPaymentRow;
    try {
      await db.runAsync(
        `INSERT INTO collection_payments
           (id, visit_id, collector_id, amount, payment_method, paid_at, created_at, status, remittance_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)
         ON CONFLICT(id) DO UPDATE SET remittance_id = excluded.remittance_id`,
        [row.id, row.visit_id, row.collector_id, row.amount, row.payment_method, row.paid_at, row.created_at, row.remittance_id],
      );
    } catch (err) {
      // One malformed row must never abort the rest of the ledger pull.
      console.error('[payment-ledger] failed to apply collection_payments row', row.id, err);
    }
  }
}

async function pullCodPaymentLedger(db: SQLiteDatabase, agentId: string): Promise<void> {
  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase
        .from('cod_payments')
        .select('id, po_id, driver_id, amount, payment_method, paid_at, created_at, cod_remittance_id')
        .eq('driver_id', agentId),
    ),
    SYNC_TIMEOUT_MS,
    'sync-down cod_payments',
  );
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = raw as RemoteCodPaymentRow;
    try {
      await db.runAsync(
        `INSERT INTO cod_payments
           (id, po_id, driver_id, amount, payment_method, paid_at, created_at, status, cod_remittance_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)
         ON CONFLICT(id) DO UPDATE SET cod_remittance_id = excluded.cod_remittance_id`,
        [row.id, row.po_id, row.driver_id, row.amount, row.payment_method, row.paid_at, row.created_at, row.cod_remittance_id],
      );
    } catch (err) {
      console.error('[payment-ledger] failed to apply cod_payments row', row.id, err);
    }
  }
}

/**
 * Pulls the collector's/driver's own payment ledger so on-hand can be computed
 * per-payment (link IS NULL). Role-gated by RLS: a collector gets zero
 * cod_payments and vice versa, no error. Each side is independently guarded so
 * one failed/empty pull never blocks the other — same best-effort contract as
 * the other syncDown() pulls.
 */
export async function syncPaymentLedgerDown(db: SQLiteDatabase, agentId: string): Promise<void> {
  try {
    await pullCollectionPaymentLedger(db, agentId);
  } catch (err) {
    console.error('[payment-ledger] collection_payments pull failed:', err);
  }
  try {
    await pullCodPaymentLedger(db, agentId);
  } catch (err) {
    console.error('[payment-ledger] cod_payments pull failed:', err);
  }
}
