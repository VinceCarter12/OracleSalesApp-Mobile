import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { normalizeCompanyName } from './company-name';

// T-001: local-first data layer (ADR-001/002/004). This is the PRIMARY write
// path — clients/meetings are read/written here first, then queued in
// `outbox` for the sync engine (T-002) to push to Supabase when online.
// Schema mirrors the live Supabase schema after migration 013
// (see Database.md "Migration 013") — never invent a parallel shape.

export const DATABASE_NAME = 'oracle-sales-app.db';

// Bump this and add a new `case` below whenever the schema changes — never
// edit an already-shipped case, since devices may have already run it.
const LATEST_SCHEMA_VERSION = 5;

/**
 * Runs once per app launch via `SQLiteProvider`'s `onInit` (see app/_layout.tsx).
 * Uses `PRAGMA user_version` so each migration step applies exactly once per
 * device, in order, regardless of which version the device is upgrading from.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= LATEST_SCHEMA_VERSION) return;

  // Foreign keys are validated by the sync layer against Supabase, not
  // enforced locally — an agent can create a meeting for a client that
  // hasn't synced yet, so a hard FK constraint would block valid offline use.
  await db.execAsync('PRAGMA journal_mode = WAL');

  if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE clients (
        id TEXT PRIMARY KEY NOT NULL,
        company_name TEXT NOT NULL,
        contact_person TEXT,
        position TEXT,
        contact_number TEXT,
        address_line1 TEXT,
        address_line2 TEXT,
        landmark TEXT,
        province TEXT,
        city TEXT,
        customer_type TEXT,
        sales_channel TEXT,
        status TEXT NOT NULL DEFAULT 'prospect',
        agent_id TEXT NOT NULL,
        details_deadline_at TEXT,
        details_completed_at TEXT,
        inactive_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        local_updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_clients_agent_id ON clients (agent_id);
      CREATE INDEX idx_clients_sync_status ON clients (sync_status);

      CREATE TABLE meetings (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT,
        agent_id TEXT NOT NULL,
        gps_lat REAL,
        gps_lng REAL,
        selfie_url TEXT,
        agendas TEXT NOT NULL DEFAULT '[]',
        outcome TEXT,
        meeting_mode TEXT,
        start_photo_url TEXT,
        start_captured_at TEXT,
        end_photo_url TEXT,
        end_captured_at TEXT,
        logged_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        local_updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_meetings_client_id ON meetings (client_id);
      CREATE INDEX idx_meetings_agent_id ON meetings (agent_id);
      CREATE INDEX idx_meetings_sync_status ON meetings (sync_status);

      -- Generic outbox: one row per pending write, any table. Client-generated
      -- UUIDs on clients/meetings make server upserts idempotent, so retries
      -- after a partial sync never duplicate a record.
      CREATE TABLE outbox (
        id TEXT PRIMARY KEY NOT NULL,
        record_id TEXT NOT NULL,
        table_name TEXT NOT NULL CHECK (table_name IN ('clients', 'meetings')),
        operation TEXT NOT NULL CHECK (operation IN ('insert', 'update')),
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_outbox_pending ON outbox (synced_at) WHERE synced_at IS NULL;

      -- Read-only mirror of every company name (all agents), populated by the
      -- T-002 sync-down. Lets Create Client check duplicates offline (ADR-003)
      -- without needing full read access to other agents' client records.
      CREATE TABLE company_names_snapshot (
        company_name TEXT PRIMARY KEY NOT NULL,
        synced_at TEXT NOT NULL
      );
    `);
    currentVersion = 1;
  }

  // T-005: duplicate-detection + sync-conflict state machine. Adds columns
  // only — never edits the v1 block above, since devices may already be on
  // version 1.
  if (currentVersion === 1) {
    await db.execAsync(`
      ALTER TABLE clients ADD COLUMN normalized_name TEXT;
      ALTER TABLE clients ADD COLUMN sync_error TEXT;
      ALTER TABLE meetings ADD COLUMN sync_error TEXT;

      ALTER TABLE outbox ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'synced', 'conflict', 'failed'));
      ALTER TABLE outbox ADD COLUMN last_error TEXT;
      ALTER TABLE outbox ADD COLUMN last_attempt_at TEXT;
      ALTER TABLE outbox ADD COLUMN next_attempt_at TEXT;
    `);

    // SQLite can't call the TS normalizer, so backfill row-by-row here —
    // must stay identical to lib/company-name.ts's normalizeCompanyName().
    const existingClients = await db.getAllAsync<{ id: string; company_name: string }>(
      'SELECT id, company_name FROM clients'
    );
    for (const client of existingClients) {
      await db.runAsync('UPDATE clients SET normalized_name = ? WHERE id = ?', [
        normalizeCompanyName(client.company_name),
        client.id,
      ]);
    }

    await db.runAsync("UPDATE outbox SET status = 'synced' WHERE synced_at IS NOT NULL");
    await db.runAsync("UPDATE outbox SET status = 'pending' WHERE synced_at IS NULL");

    // Breaking shape change (client_id becomes the key, name column added) —
    // this is a pure cache table repopulated wholesale by the next
    // sync-down, so dropping it is safe (ADR: see Migration-014-Report.md).
    await db.execAsync(`
      DROP TABLE IF EXISTS company_names_snapshot;
      CREATE TABLE company_names_snapshot (
        client_id TEXT PRIMARY KEY NOT NULL,
        company_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        synced_at TEXT NOT NULL
      );
      CREATE INDEX idx_company_names_snapshot_normalized ON company_names_snapshot (normalized_name);
    `);

    currentVersion = 2;
  }

  // T-006: Complete/Edit Info needs a single free-text office address column
  // — the structured address_line1/2/landmark/province/city columns above
  // are unused by any current screen and out of scope to wire up here.
  if (currentVersion === 2) {
    await db.execAsync(`ALTER TABLE clients ADD COLUMN office_address TEXT;`);
    currentVersion = 3;
  }

  // Existing-client fast path revision (2026-07-16, revises ADR-015): the
  // start step drops its photo requirement (GPS+timestamp only, via a Start
  // button); the end step keeps photo+GPS+timestamp. Admin (web) manually
  // validates the meeting by matching start GPS to end GPS, so both need
  // their own columns — `gps_lat`/`gps_lng` above stay the START location.
  if (currentVersion === 3) {
    await db.execAsync(`
      ALTER TABLE meetings ADD COLUMN end_gps_lat REAL;
      ALTER TABLE meetings ADD COLUMN end_gps_lng REAL;
    `);
    currentVersion = 4;
  }

  // T-014 (ADR-022, Phase A): outbox 5-state machine — adds `syncing` (an
  // in-flight state so a row being pushed right now isn't indistinguishable
  // from one that's never been attempted) — and drops the hardcoded
  // `table_name CHECK IN ('clients','meetings')` constraint in favor of the
  // TypeScript entity registry (lib/sync/entity-registry.ts), so adding a
  // future synced entity is a registry entry, not a DB migration. Also adds
  // `priority` (lower = pushed first; the registry assigns it on enqueue,
  // not this migration) for push ordering across entity types. SQLite can't
  // ALTER a CHECK constraint, so this follows the same create-new →
  // copy-data → drop-old → rename pattern already used for
  // `company_names_snapshot` in the v1 block above.
  if (currentVersion === 4) {
    await db.execAsync(`
      CREATE TABLE outbox_new (
        id TEXT PRIMARY KEY NOT NULL,
        record_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('insert', 'update')),
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed')),
        last_error TEXT,
        last_attempt_at TEXT,
        next_attempt_at TEXT,
        priority INTEGER NOT NULL DEFAULT 100
      );

      INSERT INTO outbox_new
        (id, record_id, table_name, operation, payload, created_at, synced_at,
         retry_count, status, last_error, last_attempt_at, next_attempt_at, priority)
      SELECT
        id, record_id, table_name, operation, payload, created_at, synced_at,
        retry_count, status, last_error, last_attempt_at, next_attempt_at,
        CASE table_name WHEN 'clients' THEN 10 WHEN 'meetings' THEN 20 ELSE 100 END
      FROM outbox;

      DROP TABLE outbox;
      ALTER TABLE outbox_new RENAME TO outbox;

      CREATE INDEX idx_outbox_pending ON outbox (synced_at) WHERE synced_at IS NULL;
    `);
    currentVersion = 5;
  }

  // Next schema change: `if (currentVersion === 5) { ...; currentVersion = 6; }`

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}

let dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * For code outside the React tree (T-002 sync engine, background tasks).
 * Screens/components should prefer `useSQLiteContext()` from `expo-sqlite`
 * instead, since it shares the connection `SQLiteProvider` already opened.
 */
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await migrateDbIfNeeded(db);
      return db;
    });
  }
  return dbPromise;
}
