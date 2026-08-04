import { supabase } from '../supabase';
import { withTimeout } from '../with-timeout';
import type { SQLiteDatabase } from 'expo-sqlite';

// Batch 7C (ADR-053): real sync-down pulls for the LIVE Batch 7B surfaces
// (migrations 057-060, deployed 2026-08-02): `cutoff_periods`,
// `get_my_cutoff_usage_summary()`, `get_client_cutoff_allowance()`. Follows
// lib/sync/policy-sync-down.ts's `pullClientCycles` pattern exactly: a
// thrown fetch error is caught and leaves the existing local snapshot
// untouched (offline-safe), while a legitimate successful — possibly
// empty — response wholesale-rebuilds the snapshot table (a period closing,
// a target being unset, etc. must disappear locally, not linger).
//
// Called ONLY from lib/sync-down.ts's syncDown(), and ONLY when
// isFeatureEnabled('cutoff_quota_v1') is true — see that file's guard. When
// the flag is OFF this module is never imported into an executing code path
// at runtime beyond the guarded call site, so no network call happens.

const SYNC_TIMEOUT_MS = 15000;

interface CutoffPeriodRow {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  sales_target: number | null;
  rsr_target: number | null;
  client_meeting_cap: number;
  status: string;
  supersedes_period_id: string | null;
  version: number | null;
}

/**
 * `public.cutoff_periods` — only the row covering today, broad authenticated
 * read RLS. Periods are generated ahead as `status='active'` (Settings'
 * "Generate" — dozens of rows can carry that status at once), so `status`
 * alone is not enough; the date filter mirrors web's `activePeriod()` and the
 * two RPCs' own `active` CTE (migration 066).
 */
export async function pullCutoffPeriods(db: SQLiteDatabase, now: string): Promise<void> {
  try {
    const today = now.slice(0, 10);
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase
          .from('cutoff_periods')
          .select('*')
          .eq('status', 'active')
          .lte('starts_on', today)
          .gte('ends_on', today)
      ),
      SYNC_TIMEOUT_MS,
      'sync-down cutoff periods'
    );
    if (error) throw new Error(error.message);

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM cutoff_periods_snapshot');
      for (const row of (data ?? []) as CutoffPeriodRow[]) {
        await db.runAsync(
          `INSERT INTO cutoff_periods_snapshot
            (id, label, starts_on, ends_on, sales_target, rsr_target, client_meeting_cap, status, supersedes_period_id, version, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.label,
            row.starts_on,
            row.ends_on,
            row.sales_target ?? null,
            row.rsr_target ?? null,
            row.client_meeting_cap,
            row.status,
            row.supersedes_period_id ?? null,
            row.version ?? null,
            now,
          ]
        );
      }
    });
  } catch (err) {
    console.error('[sync-down] cutoff periods pull failed:', err);
  }
}

interface CutoffUsageSummaryRow {
  period_id: string | null;
  period_label: string | null;
  starts_on: string | null;
  ends_on: string | null;
  role: string;
  target: number | null;
  confirmed_count: number | null;
  remaining: number | null;
}

/** `public.get_my_cutoff_usage_summary()` — caller's own role-scoped usage; at most one row. */
export async function pullCutoffRoleUsage(db: SQLiteDatabase, agentId: string, now: string): Promise<void> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_my_cutoff_usage_summary')),
      SYNC_TIMEOUT_MS,
      'sync-down cutoff role usage'
    );
    if (error) throw new Error(error.message);

    const rows: CutoffUsageSummaryRow[] = data ?? [];
    const row = rows[0] ?? null;

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM cutoff_role_usage_snapshot WHERE agent_id = ?', [agentId]);
      if (!row) return;
      await db.runAsync(
        `INSERT INTO cutoff_role_usage_snapshot
          (agent_id, period_id, period_label, starts_on, ends_on, role, target, confirmed_count, remaining, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          agentId,
          row.period_id ?? null,
          row.period_label ?? null,
          row.starts_on ?? null,
          row.ends_on ?? null,
          row.role,
          row.target ?? null,
          row.confirmed_count ?? null,
          row.remaining ?? null,
          now,
        ]
      );
    });
  } catch (err) {
    console.error('[sync-down] cutoff role usage pull failed:', err);
  }
}

interface ClientAllowanceRow {
  period_id: string | null;
  period_label: string | null;
  starts_on: string | null;
  ends_on: string | null;
  used: number | null;
  cap: number | null;
  remaining: number | null;
}

/**
 * `public.get_client_cutoff_allowance(p_client_id)` — one row per
 * locally-owned `new`/`existing` client (contract: prospect/in_progress
 * never get a row, which is correct, not a bug). The function takes a
 * single client id, so this loops over the agent's own capped-eligible
 * clients rather than one bulk query — no bulk RPC exists for this surface.
 * One failing client lookup must never abort the rest, matching
 * lib/sync-down.ts's per-row resilience elsewhere.
 */
export async function pullCutoffClientAllowance(db: SQLiteDatabase, agentId: string, now: string): Promise<void> {
  let clientIds: string[];
  try {
    const rows = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM clients WHERE agent_id = ? AND customer_type IN ('new', 'existing')",
      [agentId]
    );
    clientIds = rows.map((r) => r.id);
  } catch (err) {
    console.error('[sync-down] cutoff client allowance: failed to read local client list:', err);
    return;
  }

  const results: Array<{ clientId: string; row: ClientAllowanceRow | null }> = [];
  for (const clientId of clientIds) {
    try {
      const { data, error } = await withTimeout(
        Promise.resolve(supabase.rpc('get_client_cutoff_allowance', { p_client_id: clientId })),
        SYNC_TIMEOUT_MS,
        `sync-down cutoff client allowance ${clientId}`
      );
      if (error) throw new Error(error.message);
      const rows: ClientAllowanceRow[] = data ?? [];
      results.push({ clientId, row: rows[0] ?? null });
    } catch (err) {
      console.error(`[sync-down] cutoff client allowance pull failed for client ${clientId}:`, err);
      // Skip this client only — do not touch its existing snapshot row, and
      // do not abort the remaining clients in this pass.
    }
  }

  try {
    await db.withTransactionAsync(async () => {
      for (const { clientId, row } of results) {
        await db.runAsync('DELETE FROM cutoff_client_allowance_snapshot WHERE client_id = ?', [clientId]);
        if (!row) continue;
        await db.runAsync(
          `INSERT INTO cutoff_client_allowance_snapshot
            (client_id, period_id, period_label, starts_on, ends_on, used, cap, remaining, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            clientId,
            row.period_id ?? null,
            row.period_label ?? null,
            row.starts_on ?? null,
            row.ends_on ?? null,
            row.used ?? null,
            row.cap ?? null,
            row.remaining ?? null,
            now,
          ]
        );
      }
    });
  } catch (err) {
    console.error('[sync-down] cutoff client allowance snapshot write failed:', err);
  }
}

/**
 * Runs all three Batch 7B pulls. Called from lib/sync-down.ts's syncDown()
 * ONLY when `isFeatureEnabled('cutoff_quota_v1')` is true — never invoked
 * (and therefore no network call ever made) while the flag is OFF.
 */
export async function syncCutoffQuotaSnapshots(db: SQLiteDatabase, agentId: string): Promise<void> {
  const now = new Date().toISOString();
  await pullCutoffPeriods(db, now);
  await pullCutoffRoleUsage(db, agentId, now);
  await pullCutoffClientAllowance(db, agentId, now);
}
