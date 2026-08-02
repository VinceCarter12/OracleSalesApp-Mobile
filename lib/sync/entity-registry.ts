import {
  upsertSyncedClient,
  upsertSyncedClientEditRequest,
  upsertSyncedCodRemittance,
  upsertSyncedCollectionVisit,
  upsertSyncedMeeting,
  upsertSyncedPurchaseOrder,
  upsertSyncedRemittance,
  upsertSyncedTagAlongRequest,
} from './entity-appliers';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-014 (ADR-022 #9): single source of truth for "what tables sync" —
// replaces the old hardcoded `OUTBOX_TABLES` array in sync-engine.ts and the
// per-table `if/else` branches in sync-down.ts. Adding a future entity
// (Tasks, etc.) is one more entry here, not a multi-file hardcoded change.

export type EntityTableName =
  | 'clients'
  | 'meetings'
  | 'tag_along_requests'
  | 'client_edit_requests'
  | 'collection_visits'
  | 'purchase_orders'
  | 'remittances'
  | 'cod_remittances';

/**
 * Structural constraint for `SyncEntityConfig.applyScope` (ADR-030): matches
 * the fluent shape of Supabase's PostgrestFilterBuilder (`.eq()`/`.or()`
 * both return `this`) without importing its concrete, deeply-generic type —
 * keeps this file decoupled from postgrest-js's exact type params while
 * staying fully typed (no `any`).
 */
export interface ScopableQuery<Self> {
  eq: (column: string, value: string) => Self;
  or: (filters: string) => Self;
}

export interface EntityDependency {
  /** The other entity this one's outbox row depends on (e.g. a meeting depends on its client). */
  table: EntityTableName;
  /** Pulls the dependency's foreign key out of this entity's own outbox payload; null if none. */
  extractForeignKey: (payload: Record<string, unknown>) => string | null;
}

export interface SyncEntityConfig {
  remoteTable: string;
  /** Lower pushes first (business entities are single/low tens; the sync_audit lane in ./audit-log.ts uses 900 so it never jumps ahead). */
  priority: number;
  onConflict: string;
  /** Applies a synced-down remote row to the local SQLite mirror (replaces sync-down.ts's old per-table branch). `agentId` is threaded through for LWW-overwrite audit enqueueing (ADR-026 P3 item 13) — not every applier uses it. */
  applyRemoteRow: (db: SQLiteDatabase, row: Record<string, unknown>, now: string, agentId: string) => Promise<void>;
  dependencies?: EntityDependency[];
  /**
   * Scopes the sync-down pull query. Defaults to `sync-down.ts::pullEntity`'s
   * own `.eq(agentColumn, agentId)` when absent. `tag_along_requests` is the
   * first entity needing an OR-scoped "things other people created that
   * reference me" pull (ADR-030) — built as a generalizable registry
   * capability for F-004's real build and future T-006 approvals.
   */
  applyScope?: <Q extends ScopableQuery<Q>>(query: Q, agentId: string) => Q;
}

export const ENTITY_REGISTRY: Record<EntityTableName, SyncEntityConfig> = {
  clients: {
    remoteTable: 'clients',
    priority: 10,
    onConflict: 'id',
    applyRemoteRow: upsertSyncedClient,
  },
  meetings: {
    remoteTable: 'meetings',
    priority: 20,
    onConflict: 'id',
    applyRemoteRow: upsertSyncedMeeting,
    dependencies: [
      {
        table: 'clients',
        extractForeignKey: (payload) => (payload.client_id as string | null | undefined) ?? null,
      },
    ],
  },
  // ADR-030: shared table (meeting companions as of the Pass 2.5 relocation;
  // F-004's future meeting tag-alongs reuse the same `context`-discriminated
  // table). Depends on BOTH `clients` (via `related_client_id`) and
  // `meetings` (via `related_meeting_id`, added Pass 2.5) so a companion
  // request never outraces either of its own client's or meeting's push
  // (same guard shape as meetings→clients above; meeting dependency guards
  // against the same failure class as B-013).
  tag_along_requests: {
    remoteTable: 'tag_along_requests',
    priority: 30,
    onConflict: 'id',
    applyRemoteRow: upsertSyncedTagAlongRequest,
    applyScope: (query, agentId) => query.or(`requester_id.eq.${agentId},invitee_id.eq.${agentId}`),
    dependencies: [
      {
        table: 'clients',
        extractForeignKey: (payload) => (payload.related_client_id as string | null | undefined) ?? null,
      },
      {
        table: 'meetings',
        extractForeignKey: (payload) => (payload.related_meeting_id as string | null | undefined) ?? null,
      },
    ],
  },
  // ADR-052 (Batch 6 Phase 5): offline-queueable Sales/RSR edit-approval
  // requests. Priority 35 (after tag_along_requests' 30, before
  // collection_visits' 40) — pushed after both clients AND tag-alongs, but
  // before the F-007 field-role lanes. `applyScope` restricts sync-down to
  // the requester's own rows only — a Manager's team-wide approval feed
  // comes from a separate RPC (`get_manager_approval_feed()`, Phase 6), not
  // this generic per-agent sync-down. Depends on `clients` so a request
  // never pushes ahead of its own client (same guard shape as `meetings`
  // above), since its `base_updated_at`/`base_assigned_agent_id` conflict
  // check needs the server to already know the client's current state.
  client_edit_requests: {
    remoteTable: 'client_edit_requests',
    priority: 35,
    onConflict: 'id',
    applyRemoteRow: upsertSyncedClientEditRequest,
    applyScope: (query, agentId) => query.eq('requested_by', agentId),
    dependencies: [
      {
        table: 'clients',
        extractForeignKey: (payload) => (payload.client_id as string | null | undefined) ?? null,
      },
    ],
  },
  // F-007 (web 043-046): the admin publishes the day's list; field roles read
  // the WHOLE list (RLS scopes by role) and update rows they claim/work — they
  // never INSERT, and client_name/area/claimed_by_name are denormalized, so
  // there's no `clients` dependency. `applyScope` returns the query unchanged
  // to defeat pullEntity's default per-agent `.eq()` scope (whole-day pull).
  collection_visits: {
    remoteTable: 'collection_visits',
    priority: 40,
    onConflict: 'id',
    applyRemoteRow: upsertSyncedCollectionVisit,
    applyScope: (query) => query,
  },
  purchase_orders: {
    remoteTable: 'purchase_orders',
    priority: 50,
    onConflict: 'id',
    applyRemoteRow: upsertSyncedPurchaseOrder,
    applyScope: (query) => query,
  },
  // F-007 remittances (web 043/044). Unlike the day lists above, these ARE
  // per-agent — a collector/driver only ever reads back their OWN remittances
  // (RLS SELECT), so they scope the pull by collector_id/driver_id. Priority is
  // after the visits/POs they reference so a same-pass sync stays sensible.
  remittances: {
    remoteTable: 'remittances',
    priority: 60,
    onConflict: 'id',
    applyRemoteRow: upsertSyncedRemittance,
    applyScope: (query, agentId) => query.eq('collector_id', agentId),
  },
  cod_remittances: {
    remoteTable: 'cod_remittances',
    priority: 70,
    onConflict: 'id',
    applyRemoteRow: upsertSyncedCodRemittance,
    applyScope: (query, agentId) => query.eq('driver_id', agentId),
  },
};

export function isEntityTableName(tableName: string): tableName is EntityTableName {
  return tableName in ENTITY_REGISTRY;
}

/**
 * Generalizes the old hardcoded `isBlockedByPendingClient`: any entity can
 * declare a dependency on another entity's row being synced first, keyed by
 * a foreign key extracted from its own outbox payload. Pushing a dependent
 * row before its dependency resolves would orphan it server-side, so it's
 * skipped — without touching retry_count/status — until the dependency
 * clears. FIFO ordering (priority, created_at) already covers the common
 * case; this guard is only for when the dependency's own push didn't
 * succeed this pass.
 */
export async function isBlockedByDependency(
  db: SQLiteDatabase,
  tableName: EntityTableName,
  payload: string
): Promise<boolean> {
  const config = ENTITY_REGISTRY[tableName];
  if (!config.dependencies?.length) return false;

  const parsed = JSON.parse(payload) as Record<string, unknown>;
  for (const dependency of config.dependencies) {
    const foreignKey = dependency.extractForeignKey(parsed);
    if (!foreignKey) continue;
    const depRow = await db.getFirstAsync<{ sync_status: string }>(
      `SELECT sync_status FROM ${dependency.table} WHERE id = ?`,
      [foreignKey]
    );
    if (depRow !== null && depRow.sync_status !== 'synced') return true;
  }
  return false;
}

export interface EnqueueOutboxRowInput {
  // Serves as the device-op-id for business-entity outbox rows (see
  // lib/contracts/versions.ts for the cross-reference). NOT the same field
  // as the sync_audit audit lane's separately-named
  // `AuditRowInput.deviceOpId` (lib/sync/audit-log.ts) — the two lanes have
  // distinct device-op-id fields, do not treat them as interchangeable.
  outboxId: string;
  recordId: string;
  tableName: EntityTableName;
  operation: 'insert' | 'update';
  payload: string;
  createdAt: string;
  /** B-027: was this device online (link-level, not a full backend probe) at the moment this row was queued? Null if the caller didn't check. */
  createdOnline?: boolean | null;
}

/** Enqueues a business-entity outbox row with its registry-assigned priority (lower = pushed first). Used by client-service.ts/meeting-service.ts instead of a raw INSERT so priority assignment lives in one place. */
export async function enqueueOutboxRow(db: SQLiteDatabase, input: EnqueueOutboxRowInput): Promise<void> {
  const { priority } = ENTITY_REGISTRY[input.tableName];
  await db.runAsync(
    `INSERT INTO outbox (id, record_id, table_name, operation, payload, created_at, status, priority, created_online)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      input.outboxId,
      input.recordId,
      input.tableName,
      input.operation,
      input.payload,
      input.createdAt,
      priority,
      input.createdOnline === undefined || input.createdOnline === null ? null : input.createdOnline ? 1 : 0,
    ]
  );
}
