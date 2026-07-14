import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-001: local-first data layer (ADR-001/002/004). This is the PRIMARY write
// path — clients/meetings are read/written here first, then queued in
// `outbox` for the sync engine (T-002) to push to Supabase when online.
// Schema mirrors the live Supabase schema after migration 013
// (see Database.md "Migration 013") — never invent a parallel shape.

export const DATABASE_NAME = 'oracle-sales-app.db';

// Bump this and add a new `case` below whenever the schema changes — never
// edit an already-shipped case, since devices may have already run it.
const LATEST_SCHEMA_VERSION = 1;

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

  // Next schema change: `if (currentVersion === 1) { ...; currentVersion = 2; }`

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
