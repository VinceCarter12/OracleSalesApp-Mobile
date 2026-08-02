import { supabase } from './supabase';
import { withTimeout } from './with-timeout';
import { normalizeCompanyName } from './company-name';
import { getDb } from './db';
import { ENTITY_REGISTRY, type EntityTableName } from './sync/entity-registry';
import { syncAgendaPolicyAndCycles } from './sync/policy-sync-down';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-002/T-005/T-014: the pull half of the sync engine — split out of
// sync-engine.ts to stay under the 300-line file limit. Only called from
// `runSync()` there. Dispatches per-entity via the registry
// (lib/sync/entity-registry.ts) instead of a hardcoded branch per table —
// the actual upsert SQL lives in lib/sync/entity-appliers.ts, unchanged.

const SYNC_TIMEOUT_MS = 15000;

// Registry configs carry `remoteTable` as a plain string (so future entities
// are a config addition, not a type-union edit) — `.from()` needs a literal
// key from Database['public']['Tables'], so this single-level cast is the
// dispatch boundary, same pattern as lib/mappers.ts/lib/remote-client-mapping.ts.
type RemoteTableName =
  | 'clients'
  | 'meetings'
  | 'tag_along_requests'
  | 'client_edit_requests'
  | 'collection_visits'
  | 'purchase_orders'
  | 'remittances'
  | 'cod_remittances';

// Remote column is `assigned_agent_id` on `clients` — confirmed via
// PostgREST introspection (2026-07-15); `meetings.agent_id` is correct
// as-is, this mismatch is specific to `clients`. `tag_along_requests` always
// supplies its own `applyScope` (ADR-030's OR-scoped pull), so this entry is
// unused in practice — kept only so the Record stays exhaustive.
const AGENT_SCOPED_COLUMN: Record<EntityTableName, string> = {
  clients: 'assigned_agent_id',
  meetings: 'agent_id',
  tag_along_requests: 'requester_id',
  // Always supplies its own `applyScope` (entity-registry.ts: requester-only
  // pull, ADR-052), so this entry is unused in practice — present only to
  // keep the Record exhaustive, same as tag_along_requests above.
  client_edit_requests: 'requested_by',
  // collection_visits/purchase_orders always supply their own `applyScope`
  // (whole-day pull, RLS-scoped by role), so these are unused — present only
  // to keep the Record exhaustive, same as tag_along_requests.
  collection_visits: 'collector_id',
  purchase_orders: 'driver_id',
  // remittances/cod_remittances supply their own `applyScope` (own-rows pull by
  // collector_id/driver_id), so these are unused — present to keep the Record
  // exhaustive, same as the entries above.
  remittances: 'collector_id',
  cod_remittances: 'driver_id',
};

async function pullEntity(db: SQLiteDatabase, agentId: string, tableName: EntityTableName): Promise<void> {
  const config = ENTITY_REGISTRY[tableName];
  const now = new Date().toISOString();
  const baseQuery = supabase.from(config.remoteTable as RemoteTableName).select('*');
  // ADR-030: `applyScope`, when present, replaces the default single-column
  // `.eq()` scope below — e.g. tag_along_requests' OR-scoped "requester OR
  // invitee" pull (the first "things other people created that reference
  // me" query in this codebase). Falls back to the original `.eq()`
  // behavior for every entity that doesn't need it (clients/meetings).
  const scopedQuery = config.applyScope
    ? config.applyScope(baseQuery, agentId)
    : baseQuery.eq(AGENT_SCOPED_COLUMN[tableName], agentId);
  const { data, error } = await withTimeout(
    Promise.resolve(scopedQuery),
    SYNC_TIMEOUT_MS,
    `sync-down ${tableName}`
  );
  if (error) throw new Error(error.message);
  // One bad row must never abort the rest of the pull — same resilience
  // principle as lib/sync/push-batch.ts's push side. Without this, the
  // 2026-07-18 logged_at mapping bug turned a single malformed meeting row
  // into a permanently-failing sync-down for every remaining row, every pass.
  for (const row of data ?? []) {
    try {
      await config.applyRemoteRow(db, row as Record<string, unknown>, now, agentId);
    } catch (err) {
      console.error(`[sync-down] failed to apply ${tableName} row ${(row as { id?: string }).id}:`, err);
    }
  }
}

/**
 * Pulls the agent's own clients/meetings, plus a read-only company-name
 * snapshot for the offline duplicate-name check (ADR-003/T-005). The
 * snapshot is best-effort UX only — the server unique constraint (once
 * Migration 014 lands) is the final authority at sync time.
 *
 * ADR-030: `teamId` is optional and threaded through only where the caller
 * actually has it (currently `use-sync.ts` via the session store) — callers
 * that only have `agentId` (client-service.ts/meeting-service.ts's
 * best-effort immediate post-write sync) simply omit it, and the team-roster
 * pull below no-ops for that one pass; the next connectivity/drain-timer
 * sync (which does carry `teamId`) picks it up.
 */
export async function syncDown(agentId: string, teamId?: string | null): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await pullEntity(db, agentId, 'clients');
  await pullEntity(db, agentId, 'meetings');
  // ADR-030: best-effort, like pullTeamRoster below — Migration 019 (the
  // table + its RLS policy) may not be applied yet on a given environment,
  // and an unguarded throw here (pullEntity's query failure is NOT caught by
  // its own per-row try/catch, only apply failures are) would abort every
  // later step in this function, including the company_names_snapshot
  // refresh that T-005's offline duplicate-check already depends on today.
  try {
    await pullEntity(db, agentId, 'tag_along_requests');
  } catch (err) {
    console.error('[sync-down] tag_along_requests pull failed:', err);
  }

  // ADR-052 (Batch 6 Phase 5): best-effort, like tag_along_requests above —
  // the live `client_edit_requests` table may not exist yet in a given
  // environment (Migration File A not pushed as of 2026-08-01), and this
  // must never abort the rest of syncDown().
  try {
    await pullEntity(db, agentId, 'client_edit_requests');
  } catch (err) {
    console.error('[sync-down] client_edit_requests pull failed:', err);
  }

  // F-007 (web 043-046): pull the day's Collection & Delivery lists. Best-effort
  // and role-gated by RLS — a collector gets all collection_visits and zero
  // purchase_orders (and vice versa); every other role gets zero of both, no
  // error. Guarded so an empty/failed pull never aborts the rest of syncDown.
  try {
    await pullEntity(db, agentId, 'collection_visits');
  } catch (err) {
    console.error('[sync-down] collection_visits pull failed:', err);
  }
  try {
    await pullEntity(db, agentId, 'purchase_orders');
  } catch (err) {
    console.error('[sync-down] purchase_orders pull failed:', err);
  }

  // F-007 remittances — a collector/driver reads back their OWN (RLS-scoped by
  // collector_id/driver_id via the registry's applyScope). Needed so the Remit
  // screens can exclude already-remitted visits/POs from "on hand". Best-effort
  // and role-gated: a collector gets zero cod_remittances and vice versa.
  try {
    await pullEntity(db, agentId, 'remittances');
  } catch (err) {
    console.error('[sync-down] remittances pull failed:', err);
  }
  try {
    await pullEntity(db, agentId, 'cod_remittances');
  } catch (err) {
    console.error('[sync-down] cod_remittances pull failed:', err);
  }

  // No owner info in the snapshot (privacy decision, T-005) — just enough to
  // detect a name+city collision offline. City is required here because a
  // same company name in another city is a valid separate client.
  //
  // Batch 2 (2026-07-26): switched from a direct `clients` table read to the
  // `get_company_directory()` RPC. The new RLS policies scope `clients`
  // SELECT to the agent's own rows (or a manager's team), so a raw
  // cross-agent select here would silently return only the caller's own
  // clients post-Migration-031 — degrading this from a real cross-agent
  // duplicate check to a no-op. The RPC is SECURITY DEFINER and
  // deliberately exposes only company-identity columns (id, company_name,
  // normalized_company_name, city), never full client rows, so this stays
  // strictly narrower than the old broad-read access it replaces. See
  // Migration-030-Report.md.
  const { data: companyNames, error: namesError } = await withTimeout(
    Promise.resolve(supabase.rpc('get_company_directory')),
    SYNC_TIMEOUT_MS,
    'sync-down company names'
  );
  if (namesError) throw new Error(namesError.message);
  for (const row of companyNames ?? []) {
    const { id, company_name: companyName, city } = row as { id: string; company_name: string; city: string | null };
    await db.runAsync(
      'INSERT OR REPLACE INTO company_names_snapshot (client_id, company_name, normalized_name, city, synced_at) VALUES (?, ?, ?, ?, ?)',
      [id, companyName, normalizeCompanyName(companyName), city, now]
    );
  }

  await pullTeamRoster(db, agentId, teamId, now);

  // ADR-045 (Batch 3, SQLite v14): agenda-policy catalog/stage-rules/
  // policy-version mirrors + client_cycles snapshot. Best-effort like the
  // pulls above — see lib/sync/policy-sync-down.ts for the per-table error
  // handling (each of the four tables catches its own failure independently
  // so one bad pull never blocks another).
  await syncAgendaPolicyAndCycles(db, agentId);
}

/**
 * ADR-030: read-only mirror of the agent's team roster (managers + same-team
 * teammates) for Record Meeting's "Kasama sa visit" companion picker
 * (relocated there from Complete Info as of Pass 2.5). Modeled on the
 * `company_names_snapshot` pull above, but
 * deliberately NOT append/upsert-only — this does a full wipe-and-repopulate
 * inside a transaction, because staleness matters here in a way it doesn't
 * for company names: a teammate transferred off the team must disappear
 * from the picker, not linger as a stale row. Best-effort like the pull
 * above: if `teamId` is missing, or the query errors (e.g. Migration 019's
 * "Team members read teammate profiles" RLS policy isn't applied yet), this
 * must never fail or abort the rest of `syncDown()`.
 */
async function pullTeamRoster(
  db: SQLiteDatabase,
  profileId: string,
  teamId: string | null | undefined,
  now: string
): Promise<void> {
  if (!teamId) return;
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase
          .from('profiles')
          .select('id, full_name, role, team_id, avatar_url')
          .eq('team_id', teamId)
          .neq('id', profileId)
          .in('role', ['sales_manager', 'sales_specialist', 'rsr'])
      ),
      SYNC_TIMEOUT_MS,
      'sync-down team roster'
    );
    if (error) throw new Error(error.message);

    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM team_roster_snapshot');
      for (const row of data ?? []) {
        const teammate = row as {
          id: string;
          full_name: string;
          role: string;
          team_id: string | null;
          avatar_url: string | null;
        };
        // team_id is guaranteed non-null by the `.eq('team_id', teamId)`
        // scope above, but the column itself is nullable remotely.
        if (!teammate.team_id) continue;
        await db.runAsync(
          `INSERT INTO team_roster_snapshot (profile_id, full_name, role, team_id, avatar_url, synced_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [teammate.id, teammate.full_name, teammate.role, teammate.team_id, teammate.avatar_url, now]
        );
      }
    });
  } catch (err) {
    console.error('[sync-down] team roster pull failed:', err);
  }
}
