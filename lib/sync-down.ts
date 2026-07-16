import { supabase } from './supabase';
import { withTimeout } from './with-timeout';
import { normalizeCompanyName } from './company-name';
import { getDb } from './db';
import { ENTITY_REGISTRY, type EntityTableName } from './sync/entity-registry';
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
type RemoteTableName = 'clients' | 'meetings';

// Remote column is `assigned_agent_id` on `clients` — confirmed via
// PostgREST introspection (2026-07-15); `meetings.agent_id` is correct
// as-is, this mismatch is specific to `clients`.
const AGENT_SCOPED_COLUMN: Record<EntityTableName, string> = {
  clients: 'assigned_agent_id',
  meetings: 'agent_id',
};

async function pullEntity(db: SQLiteDatabase, agentId: string, tableName: EntityTableName): Promise<void> {
  const config = ENTITY_REGISTRY[tableName];
  const now = new Date().toISOString();
  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase
        .from(config.remoteTable as RemoteTableName)
        .select('*')
        .eq(AGENT_SCOPED_COLUMN[tableName], agentId)
    ),
    SYNC_TIMEOUT_MS,
    `sync-down ${tableName}`
  );
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    await config.applyRemoteRow(db, row as Record<string, unknown>, now);
  }
}

/**
 * Pulls the agent's own clients/meetings, plus a read-only company-name
 * snapshot for the offline duplicate-name check (ADR-003/T-005). The
 * snapshot is best-effort UX only — the server unique constraint (once
 * Migration 014 lands) is the final authority at sync time.
 */
export async function syncDown(agentId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await pullEntity(db, agentId, 'clients');
  await pullEntity(db, agentId, 'meetings');

  // No owner info in the snapshot (privacy decision, T-005) — just enough to
  // detect a name collision offline.
  const { data: companyNames, error: namesError } = await withTimeout(
    Promise.resolve(supabase.from('clients').select('id, company_name')),
    SYNC_TIMEOUT_MS,
    'sync-down company names'
  );
  if (namesError) throw new Error(namesError.message);
  for (const row of companyNames ?? []) {
    const { id, company_name: companyName } = row as { id: string; company_name: string };
    await db.runAsync(
      'INSERT OR REPLACE INTO company_names_snapshot (client_id, company_name, normalized_name, synced_at) VALUES (?, ?, ?, ?)',
      [id, companyName, normalizeCompanyName(companyName), now]
    );
  }
}
