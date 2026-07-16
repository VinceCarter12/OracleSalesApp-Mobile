import { supabase } from '../supabase';
import { withTimeout } from '../with-timeout';
import { ENTITY_REGISTRY, isEntityTableName } from './entity-registry';
import { AUDIT_OUTBOX_TABLE_NAME, AUDIT_REMOTE_TABLE } from './audit-log';
import type { Database } from '../../types/database';
import type { OutboxRow } from './outbox-row';

// T-014: the actual Supabase `.upsert()` calls — split out of push-batch.ts
// (300-line file limit). supabase-js's generated overloads are keyed to a
// single literal table name (a union `remoteTable` type collapses every
// field to `never` via its `RejectExcessProperties` helper), so a per-table
// `switch` is unavoidable here without an `any`/`unknown` bridge.
// Everything in push-batch.ts (grouping, batching, dependency checks,
// priority, audit enqueueing) stays fully registry-driven; only this literal
// call site needs the table name spelled out.

const SYNC_TIMEOUT_MS = 15000;

/** Known remote table names — a single-level cast at the dispatch boundary, same pattern as lib/mappers.ts/lib/remote-client-mapping.ts. */
type RemoteTableName = 'clients' | 'meetings' | typeof AUDIT_REMOTE_TABLE;

/**
 * The outbox stores each row's payload pre-shaped for its own remote table
 * (built by client-service.ts/meeting-service.ts/audit-log.ts at enqueue
 * time), so by the time it reaches here it's already the right shape for
 * whichever table it targets — this union is just enough for `.upsert()`'s
 * generic to accept a payload without a table-literal branch per call site.
 */
type AnyRemoteInsertPayload =
  | Database['public']['Tables']['clients']['Insert']
  | Database['public']['Tables']['meetings']['Insert']
  | Database['public']['Tables']['sync_audit_log']['Insert'];

export interface PushTarget {
  remoteTable: string;
  onConflict: string;
}

export function getPushTarget(tableName: string): PushTarget | null {
  if (isEntityTableName(tableName)) {
    const config = ENTITY_REGISTRY[tableName];
    return { remoteTable: config.remoteTable, onConflict: config.onConflict };
  }
  if (tableName === AUDIT_OUTBOX_TABLE_NAME) {
    return { remoteTable: AUDIT_REMOTE_TABLE, onConflict: 'device_op_id,outcome' };
  }
  return null;
}

function upsertOne(remoteTable: RemoteTableName, payload: AnyRemoteInsertPayload, onConflict: string) {
  switch (remoteTable) {
    case 'clients':
      return supabase.from('clients').upsert(payload as Database['public']['Tables']['clients']['Insert'], { onConflict });
    case 'meetings':
      return supabase.from('meetings').upsert(payload as Database['public']['Tables']['meetings']['Insert'], { onConflict });
    case AUDIT_REMOTE_TABLE:
      // Plain INSERT, not `.upsert()` — confirmed via a manual SQL Editor
      // simulation (2026-07-16, same auth context/values) that a bare
      // INSERT passes RLS cleanly, while `.upsert(..., {ignoreDuplicates})`
      // (PostgREST `Prefer: resolution=ignore-duplicates`) kept failing
      // `42501` even though the policy, privileges, and payload were all
      // independently verified correct — a PostgREST-side quirk with that
      // resolution mode's interaction with RLS, not a policy bug. A retried
      // audit row hitting the `unique(device_op_id, outcome)` constraint on
      // a genuine duplicate just becomes a classified `conflict` for that
      // outbox row (harmless — audit rows are best-effort history).
      return supabase
        .from(AUDIT_REMOTE_TABLE)
        .insert(payload as Database['public']['Tables']['sync_audit_log']['Insert']);
  }
}

function upsertMany(remoteTable: RemoteTableName, payloads: AnyRemoteInsertPayload[], onConflict: string) {
  switch (remoteTable) {
    case 'clients':
      return supabase
        .from('clients')
        .upsert(payloads as Database['public']['Tables']['clients']['Insert'][], { onConflict });
    case 'meetings':
      return supabase
        .from('meetings')
        .upsert(payloads as Database['public']['Tables']['meetings']['Insert'][], { onConflict });
    case AUDIT_REMOTE_TABLE:
      // Plain INSERT — see the matching comment in upsertOne() above.
      return supabase
        .from(AUDIT_REMOTE_TABLE)
        .insert(payloads as Database['public']['Tables']['sync_audit_log']['Insert'][]);
  }
}

export async function pushSingleRow(row: OutboxRow, target: PushTarget): Promise<void> {
  const remoteTable = target.remoteTable as RemoteTableName;
  const payload = JSON.parse(row.payload) as AnyRemoteInsertPayload;
  const { error } = await withTimeout(
    Promise.resolve(upsertOne(remoteTable, payload, target.onConflict)),
    SYNC_TIMEOUT_MS,
    `outbox upsert ${row.table_name}/${row.record_id}`
  );
  if (error) throw error;
}

export async function pushChunk(rows: OutboxRow[], target: PushTarget): Promise<void> {
  const remoteTable = target.remoteTable as RemoteTableName;
  const payloads = rows.map((row) => JSON.parse(row.payload) as AnyRemoteInsertPayload);
  const { error } = await withTimeout(
    Promise.resolve(upsertMany(remoteTable, payloads, target.onConflict)),
    SYNC_TIMEOUT_MS,
    `outbox batch upsert ${target.remoteTable} (${rows.length} rows)`
  );
  if (error) throw error;
}
