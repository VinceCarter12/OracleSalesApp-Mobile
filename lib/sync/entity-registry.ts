import { upsertSyncedClient, upsertSyncedMeeting } from './entity-appliers';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-014 (ADR-022 #9): single source of truth for "what tables sync" —
// replaces the old hardcoded `OUTBOX_TABLES` array in sync-engine.ts and the
// per-table `if/else` branches in sync-down.ts. Adding a future entity
// (Tasks, etc.) is one more entry here, not a multi-file hardcoded change.

export type EntityTableName = 'clients' | 'meetings';

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
  /** Applies a synced-down remote row to the local SQLite mirror (replaces sync-down.ts's old per-table branch). */
  applyRemoteRow: (db: SQLiteDatabase, row: Record<string, unknown>, now: string) => Promise<void>;
  dependencies?: EntityDependency[];
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
  outboxId: string;
  recordId: string;
  tableName: EntityTableName;
  operation: 'insert' | 'update';
  payload: string;
  createdAt: string;
}

/** Enqueues a business-entity outbox row with its registry-assigned priority (lower = pushed first). Used by client-service.ts/meeting-service.ts instead of a raw INSERT so priority assignment lives in one place. */
export async function enqueueOutboxRow(db: SQLiteDatabase, input: EnqueueOutboxRowInput): Promise<void> {
  const { priority } = ENTITY_REGISTRY[input.tableName];
  await db.runAsync(
    `INSERT INTO outbox (id, record_id, table_name, operation, payload, created_at, status, priority)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [input.outboxId, input.recordId, input.tableName, input.operation, input.payload, input.createdAt, priority]
  );
}
