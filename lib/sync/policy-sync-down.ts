import { supabase } from '../supabase';
import { withTimeout } from '../with-timeout';
import type { SQLiteDatabase } from 'expo-sqlite';

// ADR-045 (Batch 3, SQLite v14): read-only sync-down for the four new
// server-authoritative mirrors. Split out of lib/sync-down.ts (same reason
// `pullTeamRoster` lives there today but this needed its own file to stay
// under the 300-line file-size limit) — called once per `syncDown()` pass
// from there. None of these tables are outbox/entity-registry entries:
// mobile never writes agenda catalog, policy versions, stage rules, or
// cycles, so there is no push side at all.

const SYNC_TIMEOUT_MS = 15000;

/**
 * ADR-045: `agenda_policy_versions` — "Authenticated read" RLS
 * (Migration-038-Report.md line 212), no row-level scoping. Wholesale
 * rebuild (delete + reinsert), same staleness rationale as
 * `pullTeamRoster` in lib/sync-down.ts — an Admin-retired policy version
 * must disappear from the local snapshot, not linger. Pulls ALL versions
 * (not just `is_current`), since a still-open cycle may be pinned to an
 * older, no-longer-current version (ADR-045's whole point is that a
 * historical cycle's progress must never move due to policy drift).
 */
export async function pullAgendaPolicyVersions(db: SQLiteDatabase, now: string): Promise<void> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.from('agenda_policy_versions').select('*')),
      SYNC_TIMEOUT_MS,
      'sync-down agenda policy versions'
    );
    if (error) throw new Error(error.message);

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM agenda_policy_versions_snapshot');
      for (const row of data ?? []) {
        await db.runAsync(
          `INSERT INTO agenda_policy_versions_snapshot
            (policy_version, effective_date, is_current, created_by, notes, synced_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [row.policy_version, row.effective_date, row.is_current ? 1 : 0, row.created_by ?? null, row.notes ?? null, now]
        );
      }
    });
  } catch (err) {
    console.error('[sync-down] agenda policy versions pull failed:', err);
  }
}

/** ADR-045: `agenda_catalog` — same "Authenticated read", wholesale-rebuild pattern as pullAgendaPolicyVersions above. */
export async function pullAgendaCatalog(db: SQLiteDatabase, now: string): Promise<void> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.from('agenda_catalog').select('*')),
      SYNC_TIMEOUT_MS,
      'sync-down agenda catalog'
    );
    if (error) throw new Error(error.message);

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM agenda_catalog_snapshot');
      for (const row of data ?? []) {
        await db.runAsync(
          `INSERT INTO agenda_catalog_snapshot
            (agenda_id, policy_version, display_label, progress_weight, progress_override, is_active, sort_order, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.agenda_id,
            row.policy_version,
            row.display_label,
            row.progress_weight,
            row.progress_override ?? null,
            row.is_active ? 1 : 0,
            row.sort_order,
            now,
          ]
        );
      }
    });
  } catch (err) {
    console.error('[sync-down] agenda catalog pull failed:', err);
  }
}

/** ADR-045: `agenda_stage_rules` — same "Authenticated read", wholesale-rebuild pattern as the two pulls above. */
export async function pullAgendaStageRules(db: SQLiteDatabase, now: string): Promise<void> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.from('agenda_stage_rules').select('*')),
      SYNC_TIMEOUT_MS,
      'sync-down agenda stage rules'
    );
    if (error) throw new Error(error.message);

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM agenda_stage_rules_snapshot');
      for (const row of data ?? []) {
        await db.runAsync(
          `INSERT INTO agenda_stage_rules_snapshot
            (agenda_id, policy_version, stage, is_visible, synced_at)
           VALUES (?, ?, ?, ?, ?)`,
          [row.agenda_id, row.policy_version, row.stage, row.is_visible ? 1 : 0, now]
        );
      }
    });
  } catch (err) {
    console.error('[sync-down] agenda stage rules pull failed:', err);
  }
}

/**
 * ADR-041 / Migration 035: `client_cycles`.
 *
 * B-080 RESOLVED 2026-07-29 (Migration 048, `Migration-048-Report.md`):
 * non-admin SELECT RLS policies added ("Agents read own client cycles",
 * "Managers read team client cycles"). Device-verified — a sales_specialist
 * session correctly pulled exactly their own owned rows, a sales_manager
 * session correctly pulled their team's rows. Prior to this fix, the only
 * SELECT policy was admin-only, so this pull silently succeeded with zero
 * rows for every non-admin caller (RLS filters rows, it doesn't error) —
 * that failure mode is NOT the same as an offline/network error, see the
 * wholesale-rebuild comment below for why a genuine fetch error must not
 * wipe existing data, whereas an RLS-filtered empty success legitimately
 * does.
 *
 * Scoped to `owner_id = agentId`, matching the "Agents read own" policy —
 * a manager's own pull only ever surfaces their own rows this way; team
 * rows are visible via the separate "Managers read team" policy but this
 * mobile-side scoping doesn't fetch them (no manager-team read model exists
 * yet, tracked separately from B-080).
 */
export async function pullClientCycles(db: SQLiteDatabase, agentId: string, now: string): Promise<void> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.from('client_cycles').select('*').eq('owner_id', agentId)),
      SYNC_TIMEOUT_MS,
      'sync-down client cycles'
    );
    if (error) throw new Error(error.message);

    // Wholesale rebuild: a cycle can close/reassign away from this agent
    // between syncs, and a stale "still open" row left behind would corrupt
    // agenda-policy lookups (lib/policies/agenda-policy.ts) worse than an
    // empty table would. Only reached after a successful fetch — a thrown
    // error above (real failure, e.g. offline) is caught below and leaves
    // whatever was already synced untouched.
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM client_cycles_snapshot WHERE owner_id = ?', [agentId]);
      for (const row of data ?? []) {
        await db.runAsync(
          `INSERT INTO client_cycles_snapshot
            (id, client_id, owner_id, started_at, ended_at, end_reason, lost_at, reassignable_at,
             claimed_by, claimed_at, agenda_policy_version, created_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.client_id,
            row.owner_id,
            row.started_at,
            row.ended_at ?? null,
            row.end_reason ?? null,
            row.lost_at ?? null,
            row.reassignable_at ?? null,
            row.claimed_by ?? null,
            row.claimed_at ?? null,
            row.agenda_policy_version ?? null,
            row.created_at,
            now,
          ]
        );
      }
    });
  } catch (err) {
    console.error('[sync-down] client cycles pull failed:', err);
  }
}

/** Runs all four ADR-045 mirror pulls. Called once per `syncDown()` pass (lib/sync-down.ts). */
export async function syncAgendaPolicyAndCycles(db: SQLiteDatabase, agentId: string): Promise<void> {
  const now = new Date().toISOString();
  await pullAgendaPolicyVersions(db, now);
  await pullAgendaCatalog(db, now);
  await pullAgendaStageRules(db, now);
  await pullClientCycles(db, agentId, now);
}
