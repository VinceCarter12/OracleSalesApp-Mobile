import { supabase } from '../supabase';
import { withTimeout } from '../with-timeout';
import type { SQLiteDatabase } from 'expo-sqlite';
import { manilaCalendarDate } from '../manila-calendar';

// Batch 7C (ADR-053): real sync-down pulls for the LIVE Batch 7B surfaces
// (migrations 057-060, deployed 2026-08-02): `cutoff_periods`,
// `get_my_cutoff_usage_summary()`, `get_client_cutoff_allowance()`. Follows
// lib/sync/policy-sync-down.ts's `pullClientCycles` pattern exactly: a
// thrown fetch error is caught and leaves the existing local snapshot
// untouched (offline-safe), while a legitimate successful — possibly
// empty — response wholesale-rebuilds the snapshot table (a period closing,
// a target being unset, etc. must disappear locally, not linger).
//
// Called ONLY from lib/sync-down.ts's syncDown(), for EVERY signed-in role.
// The `cutoff_quota_v1` gate this comment used to describe was removed on
// 2026-08-04 (see the call site at lib/sync-down.ts) and these pulls now always
// run; roles that carry no quota are handled by QUOTA_ROLES below instead.

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
    const today = manilaCalendarDate(now);
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
  // Web migration 109 (2026-08-19). Appended after the original eight, which
  // kept their name, type and position — so a build older than this one reads
  // the same JSON and simply never sees these. Optional here for the reverse
  // case: this build talking to a database where 109 has not been applied yet,
  // where they are absent rather than null.
  daily_target?: number | null;
  today_confirmed?: number | null;
  today_is_working_day?: boolean | null;
}

// Roles that carry a personal quota, and therefore a row worth storing.
//
// `sales_manager` was added 2026-08-16 (web migration 105): a manager used to
// be measured against whatever their team was, so the RPC returned no target
// for them and this guard correctly dropped the row. They now have a flat
// monthly target of their own, and dropping it here would leave every manager
// on "No quota configured" while the server had a real number for them.
//
// This pull runs for EVERY signed-in role (the `cutoff_quota_v1` gate was
// removed), so Collection, Delivery and executive sessions still reach here
// with no quota. They are treated exactly like "no usage row": clear any stale
// snapshot and skip the insert, rather than attempting a write the CHECK
// constraint would reject. The set must stay in step with that constraint —
// `cutoff_role_usage_snapshot` (widened by `ensureCutoffRoleUsageRoles` in
// lib/db.ts) allows precisely these three, and an insert of anything else
// fails the whole sync with "CHECK constraint failed".
const QUOTA_ROLES = new Set(['sales_specialist', 'rsr', 'sales_manager']);

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
      // No row (no active month / no target), or a role that carries no quota
      // (Collection, Delivery, executive — NOT sales_manager, which has had one
      // since web migration 105) — either way there's nothing valid to store,
      // and the cleared snapshot correctly yields "No quota configured".
      if (!row || !QUOTA_ROLES.has(row.role)) return;
      await db.runAsync(
        `INSERT INTO cutoff_role_usage_snapshot
          (agent_id, period_id, period_label, starts_on, ends_on, role, target, confirmed_count, remaining,
           daily_target, today_confirmed, today_is_working_day, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          // Null for every role but RSR, and null too against a pre-109
          // database. Both mean the same thing to the card: this role is not
          // measured by the day, so show the month alone.
          row.daily_target ?? null,
          row.today_confirmed ?? null,
          // SQLite has no boolean. The null check comes FIRST so an absent or
          // null value stays null ("not known yet") rather than collapsing to
          // 0, which the card would read as a rest day.
          row.today_is_working_day == null ? null : row.today_is_working_day ? 1 : 0,
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
 * Runs all three Batch 7B pulls. Called from lib/sync-down.ts's syncDown() on
 * every sync, for every role — the `cutoff_quota_v1` flag stopped gating this
 * on 2026-08-04 and no longer decides whether these network calls happen.
 */
export async function syncCutoffQuotaSnapshots(db: SQLiteDatabase, agentId: string): Promise<void> {
  const now = new Date().toISOString();
  await pullCutoffPeriods(db, now);
  await pullCutoffRoleUsage(db, agentId, now);
  await pullCutoffClientAllowance(db, agentId, now);
}
