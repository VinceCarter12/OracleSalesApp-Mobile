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
const LATEST_SCHEMA_VERSION = 34;

const SELFIE_PROOF_COLUMNS: readonly (readonly [string, string])[] = [
  ['selfie_captured_at', 'TEXT'],
  ['selfie_gps_lat', 'REAL'],
  ['selfie_gps_lng', 'REAL'],
];

/**
 * Idempotent `ADD COLUMN` — only adds `column` if the table doesn't already
 * have it. Needed because the F-007 "Additional Collection" migration blocks
 * were renumbered while unreleased (Phase A shipped `is_additional` at
 * user_version 24 on some dev devices, 25 on others), so a plain `ALTER … ADD
 * COLUMN` can hit "duplicate column name" on a device whose column already
 * exists at the version the block runs for. Checking `PRAGMA table_info` first
 * makes the additive step safe to (re)run from any prior Phase-A state.
 */
async function addColumnIfMissing(
  db: SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (cols.some((c) => c.name === column)) return;
  await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * The v30 selfie-proof columns are additive and safe to check on every launch.
 * A few development databases reached user_version 30 without actually
 * receiving the columns, so version gating alone can leave Save Meeting
 * attempting to insert into a missing column.
 */
async function ensureSelfieProofColumns(db: SQLiteDatabase): Promise<void> {
  for (const [column, definition] of SELFIE_PROOF_COLUMNS) {
    await addColumnIfMissing(db, 'meetings', column, definition);
  }
}

/**
 * F-007 per-payment remittance coverage (web 086/087, REMITTANCE_CONTRACT.md,
 * 2026-08-18). The remittance link moves from per-visit/per-PO to per-PAYMENT:
 *
 *  - `remittance_id` / `cod_remittance_id` — the SERVER-authoritative link,
 *    pulled down by the payment-ledger sync (lib/sync/payment-ledger-sync-down.ts).
 *    NULL ⇔ the payment is still "on hand".
 *  - `pending_*_remittance_id` — a link STAGED locally at remittance submit,
 *    awaiting its own push (lib/sync/remittance-link.ts). Kept distinct from the
 *    authoritative column so a sync-down of a not-yet-pushed link can't clobber
 *    the staged intent, and so on-hand excludes a payment the moment it's staked
 *    to a remittance.
 *  - `link_retry_count` / `link_next_attempt_at` / `link_error` — the link
 *    push's own retry/backoff bookkeeping, independent of the INSERT lane's
 *    `status`/`retry_count` (a payment row is already `status='synced'` by the
 *    time its link is pushed).
 *
 * Additive + idempotent (addColumnIfMissing), so — like ensureSelfieProofColumns
 * above — this runs unconditionally on every launch rather than behind a version
 * gate, since a device already at LATEST_SCHEMA_VERSION would otherwise never
 * receive them.
 */
async function ensureRemittanceLinkColumns(db: SQLiteDatabase): Promise<void> {
  await addColumnIfMissing(db, 'collection_payments', 'remittance_id', 'TEXT');
  await addColumnIfMissing(db, 'collection_payments', 'pending_remittance_id', 'TEXT');
  await addColumnIfMissing(db, 'collection_payments', 'link_retry_count', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'collection_payments', 'link_next_attempt_at', 'TEXT');
  await addColumnIfMissing(db, 'collection_payments', 'link_error', 'TEXT');
  await addColumnIfMissing(db, 'cod_payments', 'cod_remittance_id', 'TEXT');
  await addColumnIfMissing(db, 'cod_payments', 'pending_cod_remittance_id', 'TEXT');
  await addColumnIfMissing(db, 'cod_payments', 'link_retry_count', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'cod_payments', 'link_next_attempt_at', 'TEXT');
  await addColumnIfMissing(db, 'cod_payments', 'link_error', 'TEXT');
}

/**
 * B-111 (2026-08-10): `collection_payments` (v28) and `cod_payments` (v30)
 * are additive tables gated behind their own `currentVersion === N` block, so
 * (same class of gap as `ensureSelfieProofColumns` above) a device whose
 * `user_version` already reached the target — but whose CREATE TABLE never
 * actually completed, e.g. B-110's now-fixed dual-connection race letting two
 * concurrent `migrateDbIfNeeded()` runs interleave mid-migration — permanently
 * skips them forever, since version gating alone never re-attempts a step
 * once the stored version moves past it. Both statements are already
 * `CREATE TABLE/INDEX IF NOT EXISTS`, so safe to re-run unconditionally on
 * every launch regardless of whether this device was ever actually affected.
 */
async function ensureCriticalTablesExist(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS collection_payments (
      id TEXT PRIMARY KEY NOT NULL,
      visit_id TEXT NOT NULL,
      collector_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_photo_uri TEXT,
      receipt_photo_uri TEXT,
      payment_photo_url TEXT,
      delivery_receipt_photo_url TEXT,
      gps_lat REAL,
      gps_lng REAL,
      remarks TEXT,
      paid_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_collection_payments_status ON collection_payments (status);
    CREATE INDEX IF NOT EXISTS idx_collection_payments_visit ON collection_payments (visit_id);

    CREATE TABLE IF NOT EXISTS cod_payments (
      id TEXT PRIMARY KEY NOT NULL,
      po_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_photo_uri TEXT,
      payment_photo_url TEXT,
      gps_lat REAL,
      gps_lng REAL,
      remarks TEXT,
      paid_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cod_payments_status ON cod_payments (status);
    CREATE INDEX IF NOT EXISTS idx_cod_payments_po ON cod_payments (po_id);

    -- Store Locations (C&D maps, 2026-08-17): a store can RELOCATE, so a client
    -- keeps a NUMBERED list of candidate locations (Location 1, 2, 3…), one
    -- flagged is_current, set directly by the field officer on the ground. This
    -- is the LOCAL-FIRST mirror; the web-owned table + sync are specified in
    -- STORE_LOCATIONS_CONTRACT.md and stay web-blocked until that ships (the
    -- generated types/database.ts has no client_locations yet, so the remote
    -- push/apply wiring is deferred, exactly like partial COD before web 073).
    -- Lives here (not a versioned block) because LATEST_SCHEMA_VERSION early-
    -- returns devices at >=34 before later blocks run — same additive-table
    -- reasoning as collection_payments/cod_payments above (B-111).
    CREATE TABLE IF NOT EXISTS client_locations (
      id TEXT PRIMARY KEY NOT NULL,
      client_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      label TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'field_set',
      set_by TEXT,
      set_by_name TEXT,
      captured_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      local_updated_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      sync_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_client_locations_client ON client_locations (client_id);
    CREATE INDEX IF NOT EXISTS idx_client_locations_current ON client_locations (client_id, is_current);
  `);
}

async function ensureJointManagerTablesExist(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS joint_manager_requests (
      id TEXT PRIMARY KEY NOT NULL, client_id TEXT NOT NULL, requester_id TEXT NOT NULL,
      origin_team_id TEXT, manager_ids TEXT NOT NULL, action_kind TEXT NOT NULL,
      action_payload TEXT NOT NULL DEFAULT '{}', base_updated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', required_count INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, applied_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending', sync_error TEXT
    );
    CREATE TABLE IF NOT EXISTS joint_manager_request_decisions (
      id TEXT PRIMARY KEY NOT NULL, request_id TEXT NOT NULL, manager_id TEXT NOT NULL,
      decision TEXT NOT NULL DEFAULT 'pending', decided_at TEXT, synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS client_record_holders (
      client_id TEXT NOT NULL, manager_id TEXT NOT NULL, manager_name TEXT,
      active INTEGER NOT NULL DEFAULT 1, origin_team_id TEXT, updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL, PRIMARY KEY (client_id, manager_id)
    );
    CREATE TABLE IF NOT EXISTS manager_directory_snapshot (
      profile_id TEXT PRIMARY KEY NOT NULL, full_name TEXT NOT NULL, team_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1, synced_at TEXT NOT NULL
    );
  `);
}

/**
 * The direct Joint Manager holder experiment was retired in favour of the
 * Meeting Tag-Along authority flow. Remove only its locally queued/read-model
 * rows so an old pending outbox item can never resurrect that superseded path.
 * The remote migration history is intentionally left untouched.
 */
async function retireLegacyJointManagerData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM outbox
     WHERE table_name IN ('joint_manager_requests', 'joint_manager_request_decisions', 'client_record_holders');
    DELETE FROM joint_manager_request_decisions;
    DELETE FROM joint_manager_requests;
    DELETE FROM client_record_holders;
  `);
}

/**
 * Runs once per app launch, inside `getDb()`'s `openDb()` (called by
 * `AppDbProvider` on boot — see `lib/app-db-provider.tsx` / app/_layout.tsx).
 * Uses `PRAGMA user_version` so each migration step applies exactly once per
 * device, in order, regardless of which version the device is upgrading from.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;

  // Do this before the version short-circuit: inconsistent devices may report
  // v30 (or newer) while one or more additive columns/tables are absent.
  if (currentVersion >= LATEST_SCHEMA_VERSION) {
    await ensureSelfieProofColumns(db);
    await ensureCriticalTablesExist(db);
    await ensureRemittanceLinkColumns(db);
    await ensureJointManagerTablesExist(db);
    await retireLegacyJointManagerData(db);
    return;
  }

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

  if (currentVersion === 5) {
    // B-024/B-027 (Sync History enhancement): records whether the device
    // was online or offline at the moment a write was QUEUED (not synced) —
    // lets Sync History show "ginawa habang offline, na-upload nang online"
    // instead of only ever showing the terminal sync outcome. NULL for any
    // pre-existing row (created before this migration), which the UI treats
    // as "unknown," not "offline" — never guess a past device's connectivity.
    await db.execAsync(`ALTER TABLE outbox ADD COLUMN created_online INTEGER;`);
    currentVersion = 6;
  }

  // ADR-026 P1 item 3 (Meeting Draft Recovery): a local-only table so an
  // in-progress meeting (especially the fast path's Start-GPS-timestamp,
  // which can't be recreated with integrity if the agent just re-taps
  // Start) survives an app crash/kill between Start and the end photo.
  // Deliberately outside the outbox/entity-registry pattern above — this
  // never syncs to Supabase, it exists purely for on-device crash recovery.
  if (currentVersion === 6) {
    await db.execAsync(`
      CREATE TABLE meeting_drafts (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        flow TEXT NOT NULL CHECK (flow IN ('full', 'visit')),
        payload_json TEXT NOT NULL,
        start_captured_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_meeting_drafts_client_id ON meeting_drafts (client_id);
    `);
    currentVersion = 7;
  }

  // ADR-026 P1 item 4 (Phase C, T-014): local-only queue of confirmed-photo
  // uploads that must reach Supabase Storage AFTER their parent meeting has
  // already saved locally (ADR-026 P1 item 1's interim fix lets a meeting
  // save with only a local `file://` photo URI when the foreground upload
  // fails). Deliberately outside the outbox/entity-registry pattern — a
  // pending_upload never itself becomes a `clients`/`meetings` outbox row;
  // its own processor (lib/sync/photo-uploads.ts) uploads the file, then
  // enqueues a normal `meetings` outbox UPDATE (via
  // lib/meeting-service.ts::enqueueMeetingPhotoUrlUpdate) to patch the
  // parent meeting's remote `photo_url`/`end_photo_url` once the object
  // exists in Storage. `storage_path` is generated once by the caller
  // (`buildMeetingPhotoStoragePath`) and reused on every retry so a 409
  // "already exists" response can be treated as a success, not a failure.
  if (currentVersion === 7) {
    await db.execAsync(`
      CREATE TABLE pending_uploads (
        id TEXT PRIMARY KEY NOT NULL,
        meeting_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('selfie', 'start', 'end')),
        local_uri TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_attempt_at TEXT,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT
      );
      CREATE INDEX idx_pending_uploads_status ON pending_uploads (status);
      CREATE INDEX idx_pending_uploads_meeting_id ON pending_uploads (meeting_id);
      -- Covers processPendingUploads()'s hot query (lib/sync/photo-uploads.ts),
      -- which filters on all three together.
      CREATE INDEX idx_pending_uploads_agent_status_next_attempt
        ON pending_uploads (agent_id, status, next_attempt_at);
    `);
    currentVersion = 8;
  }

  // ADR-026 P2 item 5: `failure_class` is a diagnostic-only classification of
  // WHY a row failed (validation/network/authentication/conflict/server/
  // unknown), computed alongside — but never replacing — the existing
  // retry-decision `kind` ('conflict' | 'transient' | 'permanent') in
  // lib/sync/outbox-status.ts::classifySyncError(). Two axes, deliberately
  // separate: `kind` drives retry behavior, `failure_class` drives
  // admin-facing messaging (see lib/sync-history.ts).
  if (currentVersion === 8) {
    await db.execAsync(`
      ALTER TABLE outbox ADD COLUMN failure_class TEXT
        CHECK (failure_class IN ('validation','network','authentication','conflict','server','unknown'));
      ALTER TABLE pending_uploads ADD COLUMN failure_class TEXT
        CHECK (failure_class IN ('validation','network','authentication','conflict','server','unknown'));
    `);
    currentVersion = 9;
  }

  // ADR-030 (T-along/Tag-Along companion selector, SQLite v10): two new
  // tables. `team_roster_snapshot` is a read-only, wholesale-repopulated
  // mirror of the agent's teammates/manager (Migration 019's team-scoped
  // profiles RLS) for the Complete Info "Kasama sa visit" picker (Pass 2) —
  // modeled on `company_names_snapshot` but NOT upsert-only, since staleness
  // matters here (see lib/sync-down.ts::pullTeamRoster doc comment).
  // `tag_along_requests` mirrors the shared Supabase table (same shape used
  // for both `client_creation` companions today and F-004's future meeting
  // tag-alongs) and follows the standard sync trio (sync_status/sync_error/
  // local_updated_at) so it can be a normal entity-registry entry. The
  // `outbox.table_name` CHECK constraint was already dropped in the
  // currentVersion===4 block above (T-014, replaced by the TypeScript entity
  // registry) — no CHECK to re-add here.
  if (currentVersion === 9) {
    await db.execAsync(`
      CREATE TABLE team_roster_snapshot (
        profile_id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        team_id TEXT NOT NULL,
        avatar_url TEXT,
        synced_at TEXT NOT NULL
      );
      CREATE INDEX idx_team_roster_role ON team_roster_snapshot (role);

      CREATE TABLE tag_along_requests (
        id TEXT PRIMARY KEY NOT NULL,
        context TEXT NOT NULL CHECK (context IN ('client_creation', 'meeting')),
        requester_id TEXT NOT NULL,
        invitee_id TEXT NOT NULL,
        invitee_kind TEXT NOT NULL CHECK (invitee_kind IN ('manager', 'teammate')),
        related_client_id TEXT,
        related_meeting_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
        created_at TEXT NOT NULL,
        responded_at TEXT,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        sync_error TEXT,
        local_updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_tar_invitee ON tag_along_requests (invitee_id);
      CREATE INDEX idx_tar_requester ON tag_along_requests (requester_id);
      CREATE INDEX idx_tar_related_client ON tag_along_requests (related_client_id);
      CREATE INDEX idx_tar_sync_status ON tag_along_requests (sync_status);
    `);
    currentVersion = 10;
  }

  // 2026-07-21: `meeting-service.ts::createMeeting()` has always mapped
  // `contactPerson`/`contactPosition`/`locationType`/`locationName`/`remarks`
  // into the REMOTE Supabase payload, but the local `meetings` table never
  // had columns for them — since ADR-001 makes local SQLite the primary READ
  // path, this data was unrecoverable by the app itself even after a
  // successful sync (write-only from the app's own perspective). Meeting
  // Detail needs these to match the wireframe's Details/Remarks cards.
  // Also adds an index on `tag_along_requests.related_meeting_id`
  // (ADR-030's Pass 2.5 relocation added meeting-scoped requests but never
  // indexed the column they're looked up by).
  if (currentVersion === 10) {
    await db.execAsync(`
      ALTER TABLE meetings ADD COLUMN contact_person TEXT;
      ALTER TABLE meetings ADD COLUMN contact_position TEXT;
      ALTER TABLE meetings ADD COLUMN location_type TEXT;
      ALTER TABLE meetings ADD COLUMN location_name TEXT;
      ALTER TABLE meetings ADD COLUMN remarks TEXT;
      CREATE INDEX idx_tar_related_meeting ON tag_along_requests (related_meeting_id);
    `);
    currentVersion = 11;
  }

  // T-005 city-aware duplicate checks: the snapshot previously stored only
  // company name, which made every same-name company look like a duplicate
  // even when it belonged to a different city.
  if (currentVersion === 11) {
    await db.execAsync(`ALTER TABLE company_names_snapshot ADD COLUMN city TEXT;`);
    // Preserve city data for snapshot rows that correspond to local clients;
    // rows belonging to other agents receive their city on the next sync-down.
    await db.execAsync(`
      UPDATE company_names_snapshot
      SET city = (SELECT city FROM clients WHERE clients.id = company_names_snapshot.client_id)
      WHERE city IS NULL;
    `);
    currentVersion = 12;
  }

  // F-007 (2026-07-28): local mirrors for the Collection & Delivery lists (web
  // migrations 043/044/045/046). Read path first (Phase 1) — synced-down by
  // lib/sync/entity-appliers.ts. Columns mirror the live Supabase shape incl.
  // 045's denormalized client_name/area and 046's claim columns; booleans are
  // stored 0/1. Field roles pull the WHOLE day's list (RLS-scoped), so there's
  // no per-agent column here.
  if (currentVersion === 12) {
    await db.execAsync(`
      CREATE TABLE collection_visits (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT,
        client_name TEXT,
        area TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        scheduled_for TEXT,
        amount_due REAL,
        collector_id TEXT,
        amount_collected REAL,
        payment_method TEXT,
        payment_photo_url TEXT,
        delivery_receipt_photo_url TEXT,
        gps_lat REAL,
        gps_lng REAL,
        remarks TEXT,
        rescheduled_to TEXT,
        visited_at TEXT,
        claimed_by TEXT,
        claimed_at TEXT,
        claimed_by_name TEXT,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        sync_error TEXT,
        local_updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_collection_visits_status ON collection_visits (status);
      CREATE INDEX idx_collection_visits_scheduled_for ON collection_visits (scheduled_for);
      CREATE INDEX idx_collection_visits_sync_status ON collection_visits (sync_status);

      CREATE TABLE purchase_orders (
        id TEXT PRIMARY KEY NOT NULL,
        po_number TEXT,
        client_id TEXT,
        client_name TEXT,
        area TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        scheduled_for TEXT,
        cod INTEGER NOT NULL DEFAULT 0,
        cod_due REAL,
        driver_id TEXT,
        truck_plate TEXT,
        sequence_no INTEGER,
        receiver_name TEXT,
        receiver_signature_url TEXT,
        time_in TEXT,
        time_out TEXT,
        proof_url TEXT,
        backload_photo_url TEXT,
        gps_lat REAL,
        gps_lng REAL,
        remarks TEXT,
        cod_amount REAL,
        cod_method TEXT,
        cod_photo_url TEXT,
        cod_remitted INTEGER NOT NULL DEFAULT 0,
        claimed_by TEXT,
        claimed_at TEXT,
        claimed_by_name TEXT,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        sync_error TEXT,
        local_updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_purchase_orders_status ON purchase_orders (status);
      CREATE INDEX idx_purchase_orders_scheduled_for ON purchase_orders (scheduled_for);
      CREATE INDEX idx_purchase_orders_sync_status ON purchase_orders (sync_status);
    `);
    currentVersion = 13;
  }

  // ADR-036 (Batch 3): widens the `failure_class` CHECK constraint on
  // `outbox`/`pending_uploads` to add `'rate_limited'` (see
  // lib/sync/outbox-status.ts's `FailureClass` union, widened in the SAME
  // change per ADR-036's core point — the TS union and this migration must
  // never drift apart). SQLite can't ALTER a CHECK constraint, so this
  // follows the same create-new -> copy-data -> drop-old -> rename pattern
  // already used for `outbox` in the currentVersion===4 block above. Every
  // other column/constraint is carried over unchanged from v12.
  if (currentVersion === 13) {
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
        priority INTEGER NOT NULL DEFAULT 100,
        created_online INTEGER,
        failure_class TEXT
          CHECK (failure_class IN ('validation','network','authentication','conflict','server','rate_limited','unknown'))
      );

      INSERT INTO outbox_new
        (id, record_id, table_name, operation, payload, created_at, synced_at,
         retry_count, status, last_error, last_attempt_at, next_attempt_at,
         priority, created_online, failure_class)
      SELECT
        id, record_id, table_name, operation, payload, created_at, synced_at,
        retry_count, status, last_error, last_attempt_at, next_attempt_at,
        priority, created_online, failure_class
      FROM outbox;

      DROP TABLE outbox;
      ALTER TABLE outbox_new RENAME TO outbox;

      CREATE INDEX idx_outbox_pending ON outbox (synced_at) WHERE synced_at IS NULL;

      CREATE TABLE pending_uploads_new (
        id TEXT PRIMARY KEY NOT NULL,
        meeting_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('selfie', 'start', 'end')),
        local_uri TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_attempt_at TEXT,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        failure_class TEXT
          CHECK (failure_class IN ('validation','network','authentication','conflict','server','rate_limited','unknown'))
      );

      INSERT INTO pending_uploads_new
        (id, meeting_id, agent_id, kind, local_uri, storage_path, status,
         retry_count, last_error, last_attempt_at, next_attempt_at, created_at,
         synced_at, failure_class)
      SELECT
        id, meeting_id, agent_id, kind, local_uri, storage_path, status,
        retry_count, last_error, last_attempt_at, next_attempt_at, created_at,
        synced_at, failure_class
      FROM pending_uploads;

      DROP TABLE pending_uploads;
      ALTER TABLE pending_uploads_new RENAME TO pending_uploads;

      CREATE INDEX idx_pending_uploads_status ON pending_uploads (status);
      CREATE INDEX idx_pending_uploads_meeting_id ON pending_uploads (meeting_id);
      CREATE INDEX idx_pending_uploads_agent_status_next_attempt
        ON pending_uploads (agent_id, status, next_attempt_at);
    `);
    currentVersion = 14;
  }

  // ADR-045 (Batch 3, SQLite v15): four read-only server-authoritative
  // mirrors, same wholesale-rebuild pattern as `team_roster_snapshot`
  // (currentVersion===9 block above) — populated by
  // `lib/sync/policy-sync-down.ts`, never written to via the outbox.
  //
  // `agenda_catalog_snapshot`/`agenda_policy_versions_snapshot`/
  // `agenda_stage_rules_snapshot` mirror Migration 038 Part D exactly
  // (Migration-038-Report.md lines 180-234): `agenda_stage_rules.stage` is
  // CHECKed remotely to only `('prospect','in_progress')` — 'new'/'existing'
  // deliberately have NO rows there (ADR-046 #5: those stages show a fixed
  // hardcoded 6-ordinary-agenda list, not a stage-rule lookup) — so this
  // local mirror does not add a CHECK constraint of its own, staying a
  // faithful copy of whatever rows the server actually sends.
  //
  // `client_cycles_snapshot` mirrors Migration 035 (Migration-035-Report.md
  // lines 31-45). ⚠️ Known live-RLS gap (flagged to Vince, not fixed here):
  // `public.client_cycles`'s only SELECT policy is
  // `"Admin read client cycles" ... using (public.is_admin())`
  // (Migration-035-Report.md line 58) — sales_manager/sales_specialist/rsr
  // are NOT admin, so `lib/sync/policy-sync-down.ts`'s pull for this table
  // will return zero rows for every non-admin mobile user until a
  // server-side policy scoping SELECT to `owner_id = auth.uid()` (or
  // equivalent) is added. The table/column shapes below are still created
  // now so the mirror is ready the moment that policy lands, but nothing in
  // this app should assume `client_cycles_snapshot` is populated today.
  if (currentVersion === 14) {
    await db.execAsync(`
      CREATE TABLE client_cycles_snapshot (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        end_reason TEXT,
        lost_at TEXT,
        reassignable_at TEXT,
        claimed_by TEXT,
        claimed_at TEXT,
        agenda_policy_version INTEGER,
        created_at TEXT NOT NULL,
        synced_at TEXT NOT NULL
      );
      CREATE INDEX idx_client_cycles_snapshot_client ON client_cycles_snapshot (client_id);

      CREATE TABLE agenda_policy_versions_snapshot (
        policy_version INTEGER PRIMARY KEY NOT NULL,
        effective_date TEXT NOT NULL,
        is_current INTEGER NOT NULL,
        created_by TEXT,
        notes TEXT,
        synced_at TEXT NOT NULL
      );

      CREATE TABLE agenda_catalog_snapshot (
        agenda_id TEXT NOT NULL,
        policy_version INTEGER NOT NULL,
        display_label TEXT NOT NULL,
        progress_weight REAL NOT NULL,
        progress_override REAL,
        is_active INTEGER NOT NULL,
        sort_order INTEGER NOT NULL,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (agenda_id, policy_version)
      );
      CREATE INDEX idx_agenda_catalog_snapshot_version ON agenda_catalog_snapshot (policy_version);

      CREATE TABLE agenda_stage_rules_snapshot (
        agenda_id TEXT NOT NULL,
        policy_version INTEGER NOT NULL,
        stage TEXT NOT NULL,
        is_visible INTEGER NOT NULL,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (agenda_id, policy_version, stage)
      );
      CREATE INDEX idx_agenda_stage_rules_snapshot_version ON agenda_stage_rules_snapshot (policy_version);

      -- Migration 038 Part A/B: 'in_progress' anchor + cycle-scoped meeting
      -- eligibility. Local column names deliberately differ from the
      -- remote's \`current_cycle_id\` (shortened to \`cycle_id\`, matching
      -- \`meetings.cycle_id\` below for consistency) but keep the exact
      -- remote name where the remote name is already the natural local one
      -- (\`in_progress_at\`, \`agenda_ids\`).
      ALTER TABLE clients ADD COLUMN cycle_id TEXT;
      ALTER TABLE clients ADD COLUMN in_progress_at TEXT;

      ALTER TABLE meetings ADD COLUMN cycle_id TEXT;
      -- JSON-stringified array of stable agenda ids, additive alongside the
      -- existing \`agendas\` column (legacy display-label array) — same
      -- storage convention as \`agendas\` (lib/db.ts v1 block above).
      ALTER TABLE meetings ADD COLUMN agenda_ids TEXT NOT NULL DEFAULT '[]';
    `);
    currentVersion = 15;
  }

  // ADR-046 (correction addendum, 2026-07-28, SQLite v16): a meeting can be
  // saved locally offline even while a selected MANAGER-kind tag-along
  // companion is still pending — saving evidence and counting as
  // lifecycle-valid/quota-eligible are separate events. Mirrors the
  // wireframe's own `meeting.validityStatus` field 1:1 (Wireframe-Sales-
  // BizLink.html: `validityStatus:tagAlongPending?'pending_confirmation':'valid'`).
  // Not derived on-the-fly from `tag_along_requests` at read time — a real
  // stored column, same as the wireframe's demo data model — because it must
  // survive a declined manager tag-along staying excluded forever (not just
  // "no longer pending"), which a pure existence-of-a-pending-row join could
  // not represent on its own. DEFAULT 'valid' backfills every pre-existing
  // row (no historical meeting was ever gated by this rule). Follows the
  // `failure_class` precedent (currentVersion===8 block above) for adding a
  // CHECK constraint via plain ALTER TABLE ADD COLUMN — no create/copy/drop
  // rebuild needed since this is an addition, not a constraint widening.
  if (currentVersion === 15) {
    await db.execAsync(`
      ALTER TABLE meetings ADD COLUMN validity_status TEXT NOT NULL DEFAULT 'valid'
        CHECK (validity_status IN ('valid', 'pending_confirmation'));
    `);
    currentVersion = 16;
  }

  // ADR-044 / Migration 039 (SQLite v17): local mirror of
  // `po_confirmation_requests` (Migration-039-Report.md lines 32-46). Unlike
  // `tag_along_requests`, PO confirmation creation is NOT queued through the
  // outbox (ADR-044 decision 5: "No offline queueing... all approval actions
  // are online-only") — this table instead has an EXTRA local-only status,
  // `'draft'`, for evidence captured offline before the network call that
  // creates the real server row has happened (this slice's
  // `lib/po-confirmation-service.ts::capturePoEvidenceLocally()`). A draft
  // row's `id` becomes the server row's `id` once
  // `submitPoConfirmation()` succeeds (client-generated UUID, same
  // B-041/B-044 discipline as every other synced entity) — `po_photo_path`
  // holds the local `file://` capture URI until submission swaps it for the
  // uploaded Storage public URL, mirroring `meetings.selfie_url`'s own
  // local-then-remote lifecycle. `synced_at` tracks the last successful
  // reconciliation against `get_my_request_statuses()` — null for a row
  // never yet confirmed to exist server-side.
  if (currentVersion === 16) {
    await db.execAsync(`
      CREATE TABLE po_confirmation_requests (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT NOT NULL,
        cycle_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        requester_id TEXT NOT NULL,
        po_photo_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
        decided_by TEXT,
        decided_at TEXT,
        decision_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT
      );
      CREATE INDEX idx_po_confirmation_meeting ON po_confirmation_requests (meeting_id);
      CREATE INDEX idx_po_confirmation_requester ON po_confirmation_requests (requester_id, status);
      CREATE INDEX idx_po_confirmation_client ON po_confirmation_requests (client_id);
    `);
    currentVersion = 17;
  }

  // F-007 Phase 2b (2026-07-29, SQLite v18): generalize the meeting-only
  // `pending_uploads` lane so collection & delivery proof photos share it.
  // `meeting_id` becomes `parent_table` + `parent_id`, and the `kind` CHECK
  // widens to the 4 new collection/delivery photo kinds (payment,
  // delivery_receipt, proof, backload, cod — plus 'signature' headroom for the
  // still-in-memory receiver signature). SQLite can't ALTER a CHECK or rename a
  // column cleanly, so this uses the same create-new -> copy -> drop -> rename
  // dance as the v13 (currentVersion===13) rebuild. Existing rows are all
  // meeting photos, so they copy across with parent_table='meetings' and
  // parent_id=meeting_id. `idx_pending_uploads_meeting_id` is replaced by a
  // composite `(parent_table, parent_id)` index; the other two indexes are
  // carried over unchanged.
  if (currentVersion === 17) {
    await db.execAsync(`
      CREATE TABLE pending_uploads_new (
        id TEXT PRIMARY KEY NOT NULL,
        parent_table TEXT NOT NULL DEFAULT 'meetings'
          CHECK (parent_table IN ('meetings', 'collection_visits', 'purchase_orders')),
        parent_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN (
          'selfie', 'start', 'end',
          'payment', 'delivery_receipt',
          'proof', 'backload', 'cod', 'signature'
        )),
        local_uri TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_attempt_at TEXT,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        failure_class TEXT
          CHECK (failure_class IN ('validation','network','authentication','conflict','server','rate_limited','unknown'))
      );

      INSERT INTO pending_uploads_new
        (id, parent_table, parent_id, agent_id, kind, local_uri, storage_path,
         status, retry_count, last_error, last_attempt_at, next_attempt_at,
         created_at, synced_at, failure_class)
      SELECT
        id, 'meetings', meeting_id, agent_id, kind, local_uri, storage_path,
        status, retry_count, last_error, last_attempt_at, next_attempt_at,
        created_at, synced_at, failure_class
      FROM pending_uploads;

      DROP TABLE pending_uploads;
      ALTER TABLE pending_uploads_new RENAME TO pending_uploads;

      CREATE INDEX idx_pending_uploads_status ON pending_uploads (status);
      CREATE INDEX idx_pending_uploads_parent ON pending_uploads (parent_table, parent_id);
      CREATE INDEX idx_pending_uploads_agent_status_next_attempt
        ON pending_uploads (agent_id, status, next_attempt_at);
    `);
    currentVersion = 18;
  }

  // F-007 remittances (SQLite v19): local mirrors for the collection
  // `remittances` (web 043) and delivery `cod_remittances` (web 044) tables.
  // Field roles INSERT their own and can SELECT them back (RLS) — mobile writes
  // via the outbox and syncs them down like any other entity. The remote UUID[]
  // columns (`visit_ids`/`po_ids`) are stored here as JSON text (same convention
  // as `meetings.agendas`). Photo URLs live IN the insert (no UPDATE policy
  // remotely), so there are no separate photo columns to patch. `sync_status`
  // defaults 'pending' — a locally-created remittance not yet pushed — and the
  // appliers flip synced-down rows to 'synced'.
  if (currentVersion === 18) {
    await db.execAsync(`
      CREATE TABLE remittances (
        id TEXT PRIMARY KEY NOT NULL,
        collector_id TEXT NOT NULL,
        destination TEXT NOT NULL,
        amount_remitted REAL NOT NULL,
        amount_collected REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'submitted',
        receiver_name TEXT,
        signed_proof_url TEXT,
        receiver_signature_url TEXT,
        visit_ids TEXT NOT NULL DEFAULT '[]',
        submitted_at TEXT,
        created_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        sync_error TEXT,
        local_updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_remittances_collector ON remittances (collector_id);
      CREATE INDEX idx_remittances_sync_status ON remittances (sync_status);

      CREATE TABLE cod_remittances (
        id TEXT PRIMARY KEY NOT NULL,
        driver_id TEXT NOT NULL,
        amount_remitted REAL NOT NULL,
        amount_collected REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'submitted',
        receiver_name TEXT NOT NULL,
        receiver_signature_url TEXT,
        po_ids TEXT NOT NULL DEFAULT '[]',
        submitted_at TEXT,
        created_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        sync_error TEXT,
        local_updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_cod_remittances_driver ON cod_remittances (driver_id);
      CREATE INDEX idx_cod_remittances_sync_status ON cod_remittances (sync_status);
    `);
    currentVersion = 19;
  }

  // Batch 4 Office Location Core (2026-07-29, SQLite v20): permanent client
  // office pin is distinct from meeting GPS evidence (see
  // [[Office-Location-Spec-2026-07-29]]) — plain additive
  // `ALTER TABLE ADD COLUMN`s, same precedent as the `validity_status`
  // column above (currentVersion===15 block): a straight addition needs no
  // create/copy/drop rebuild. `office_pin_source` distinguishes an explicit
  // Set/Update Office Location save ('manual') from an automatic Client
  // Office meeting capture ('client_office_meeting') — both write through
  // `lib/office-pin-service.ts`, never a direct UPDATE elsewhere.
  if (currentVersion === 19) {
    await db.execAsync(`
      ALTER TABLE clients ADD COLUMN office_lat REAL;
      ALTER TABLE clients ADD COLUMN office_lng REAL;
      ALTER TABLE clients ADD COLUMN office_pin_updated_at TEXT;
      ALTER TABLE clients ADD COLUMN office_pin_source TEXT
        CHECK (office_pin_source IS NULL OR office_pin_source IN ('manual','client_office_meeting'));
    `);
    currentVersion = 20;
  }

  // Batch 6 Phase 5 (ADR-052, 2026-08-01): mobile foundation for the manager
  // client-edit-approval flow — no UI branch lands yet (Phase 8's job), this
  // is dead-but-safe infrastructure. `client_edit_requests` is a flat table
  // (NOT a `*_snapshot` mirror), mirroring `po_confirmation_requests`'
  // precedent (currentVersion===16 block above) since it's device-created
  // with local pre-sync state, not a read-only server-published list. Unlike
  // `po_confirmation_requests`, creation for this entity DOES queue through
  // the outbox (ADR-052 section D) — Sales/RSR edits must survive offline —
  // so its terminal states include a LOCAL-ONLY `'superseded'` status with no
  // server equivalent, set by lib/sync/outbox-status.ts when a push
  // permanently fails (403 RLS rejection / 23505 duplicate-pending) rather
  // than retrying forever. `minor_notes` is added to `clients` in the same
  // step (ADR-052 section C: the one CLIENT_EDITABLE_FIELDS entry that is
  // approval-EXEMPT, so it is written directly via `updateClientInfo()`,
  // never through a `client_edit_requests` row).
  if (currentVersion === 20) {
    await db.execAsync(`
      ALTER TABLE clients ADD COLUMN minor_notes TEXT;

      CREATE TABLE client_edit_requests (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        changes TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','superseded')),
        review_note TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        base_updated_at TEXT NOT NULL,
        base_assigned_agent_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT
      );
      CREATE INDEX idx_client_edit_requests_client_status ON client_edit_requests(client_id, status);
      CREATE INDEX idx_client_edit_requests_requester_status ON client_edit_requests(requested_by, status);
    `);
    currentVersion = 21;
  }

  // Batch 7C (ADR-053, SQLite v22): read-only mirror tables for the new
  // Admin-configured cutoff/quota feature. Mobile NEVER writes to these
  // tables directly — they exist only for a future sync-down pull
  // (lib/sync/cutoff-sync-down.ts, deliberately NOT yet wired into the live
  // sync loop since Batch 7B's server-side tables don't exist yet) to fill.
  // Shapes mirror lib/policies/cutoff-policy.ts's pure-TS types 1:1 so the
  // eventual pull function can map remote rows straight across. All three
  // will read empty until Batch 7B lands — every consumer of these tables
  // must treat an empty result as the explicit "no policy configured/no
  // active period" state (never a crash, never a hardcoded fallback).
  if (currentVersion === 21) {
    await db.execAsync(`
      CREATE TABLE cutoff_periods_snapshot (
        id TEXT PRIMARY KEY NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        synced_at TEXT NOT NULL
      );

      -- One row per (period, role): Sales Specialist and RSR each have an
      -- independently configured target (ADR-053 O-6) — never one shared
      -- global row. cap_role is NULL when a cap row is the shared/global
      -- fallback for the period rather than a role-specific override.
      CREATE TABLE cutoff_role_usage_snapshot (
        period_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('sales_specialist', 'rsr')),
        target INTEGER,
        confirmed_count INTEGER NOT NULL DEFAULT 0,
        pending_count INTEGER NOT NULL DEFAULT 0,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (period_id, agent_id)
      );
      CREATE INDEX idx_cutoff_role_usage_agent ON cutoff_role_usage_snapshot (agent_id);

      -- One row per (period, client): shared New/Existing cap pool usage
      -- (O-2/O-3) — used/cap counts already server-classified, never
      -- recomputed from raw meeting rows on this table alone.
      CREATE TABLE cutoff_client_allowance_snapshot (
        period_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        used_count INTEGER NOT NULL DEFAULT 0,
        cap INTEGER,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (period_id, client_id)
      );
      CREATE INDEX idx_cutoff_client_allowance_client ON cutoff_client_allowance_snapshot (client_id);
    `);
    currentVersion = 22;
  }

  // Batch 7C (ADR-053, SQLite v23): the v22 shapes above were written before
  // Batch 7B's live schema was confirmed and don't match the actual deployed
  // surfaces (`cutoff_periods`, `get_my_cutoff_usage_summary()`,
  // `get_client_cutoff_allowance()` — migrations 057-060, live 2026-08-02).
  // Replaced wholesale rather than patched, since no release has ever shipped
  // with the v22 shapes populated (cutoff-sync-down.ts was never wired in) —
  // there is no real data to migrate. `cutoff_role_usage_snapshot` and
  // `cutoff_client_allowance_snapshot` now hold ONE row per agent/client
  // (the RPCs return the caller's own summary / one client's allowance, not
  // a role-keyed or period-keyed set), matching `get_my_cutoff_usage_summary`
  // and `get_client_cutoff_allowance`'s actual return columns 1:1.
  if (currentVersion === 22) {
    await db.execAsync(`
      DROP TABLE IF EXISTS cutoff_periods_snapshot;
      DROP TABLE IF EXISTS cutoff_role_usage_snapshot;
      DROP TABLE IF EXISTS cutoff_client_allowance_snapshot;

      -- Mirrors public.cutoff_periods (broad authenticated read RLS). Only
      -- status='active' rows are pulled (see cutoff-sync-down.ts) — at most
      -- one row is expected, but the shape allows more without assuming it.
      CREATE TABLE cutoff_periods_snapshot (
        id TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL,
        starts_on TEXT NOT NULL,
        ends_on TEXT NOT NULL,
        sales_target INTEGER,
        rsr_target INTEGER,
        client_meeting_cap INTEGER NOT NULL,
        status TEXT NOT NULL,
        supersedes_period_id TEXT,
        version INTEGER,
        synced_at TEXT NOT NULL
      );

      -- Mirrors public.get_my_cutoff_usage_summary() — the calling agent's
      -- OWN role-scoped usage for the active period. One row per agent
      -- (never per-role/per-period — the RPC itself is role/period-implicit
      -- from the caller's session). period_id/period_label/target/
      -- confirmed_count/remaining are all independently nullable: no active
      -- period, or no target configured for the caller's role.
      CREATE TABLE cutoff_role_usage_snapshot (
        agent_id TEXT PRIMARY KEY NOT NULL,
        period_id TEXT,
        period_label TEXT,
        starts_on TEXT,
        ends_on TEXT,
        role TEXT NOT NULL CHECK (role IN ('sales_specialist', 'rsr')),
        target INTEGER,
        confirmed_count INTEGER,
        remaining INTEGER,
        synced_at TEXT NOT NULL
      );

      -- Mirrors public.get_client_cutoff_allowance(p_client_id) — one row per
      -- locally-owned new/existing client (prospect/in_progress never get a
      -- row, matching the function's own no-rows-for-uncapped-stages
      -- behavior). used/cap/remaining nullable when no active period covers
      -- this client's allowance.
      CREATE TABLE cutoff_client_allowance_snapshot (
        client_id TEXT PRIMARY KEY NOT NULL,
        period_id TEXT,
        period_label TEXT,
        starts_on TEXT,
        ends_on TEXT,
        used INTEGER,
        cap INTEGER,
        remaining INTEGER,
        synced_at TEXT NOT NULL
      );
    `);
    currentVersion = 23;
  }

  // 2026-08-04: `po_confirmation_requests` was missing the local-only
  // terminal state `client_edit_requests` already has (`'superseded'`,
  // currentVersion===20 block above) for a write that fails RLS/ownership
  // checks permanently rather than transiently. Without it, a draft whose
  // referenced client is no longer owned by the requester (reassigned,
  // deleted, stale test data) retries forever via
  // `retryDraftPoConfirmations()` on every Notifications-screen visit,
  // logging the same console error indefinitely with no way to stop. SQLite
  // can't ALTER a CHECK constraint, so this uses the same create-new ->
  // copy -> drop -> rename rebuild as the v17->v18 migration above.
  if (currentVersion === 23) {
    await db.execAsync(`
      CREATE TABLE po_confirmation_requests_new (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT NOT NULL,
        cycle_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        requester_id TEXT NOT NULL,
        po_photo_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled', 'superseded')),
        decided_by TEXT,
        decided_at TEXT,
        decision_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT
      );

      INSERT INTO po_confirmation_requests_new
        (id, client_id, cycle_id, meeting_id, requester_id, po_photo_path,
         status, decided_by, decided_at, decision_note, created_at, updated_at, synced_at)
      SELECT
        id, client_id, cycle_id, meeting_id, requester_id, po_photo_path,
        status, decided_by, decided_at, decision_note, created_at, updated_at, synced_at
      FROM po_confirmation_requests;

      DROP TABLE po_confirmation_requests;
      ALTER TABLE po_confirmation_requests_new RENAME TO po_confirmation_requests;

      CREATE INDEX idx_po_confirmation_meeting ON po_confirmation_requests (meeting_id);
      CREATE INDEX idx_po_confirmation_requester ON po_confirmation_requests (requester_id, status);
      CREATE INDEX idx_po_confirmation_client ON po_confirmation_requests (client_id);
    `);
    currentVersion = 24;
  }

  // F-007 "Additional store" (Additional Collection, 2026-08-07): the admin
  // (web) can add a store to the day's list AFTER it was published — a store
  // that "wasn't for collection today, but now is". `is_additional` flags such
  // a row so the collector app can badge it and float it to the top of the
  // list (a mid-day addition is easy to miss otherwise). Additive column,
  // default 0; a normal published row stays 0. Populated by web on the
  // `collection_visits` row (see COLLECTION_DELIVERY_STATUS_MOBILE.md
  // "Additional store" contract); until web sends it, every row reads 0 and
  // the app behaves exactly as before. The two acknowledgment columns
  // (received-by-phone / seen-by-collector) are deliberately NOT added here —
  // they're a write-back that needs the matching web columns + UPDATE RLS
  // first, tracked as Phase B in that same status note.
  if (currentVersion === 24) {
    // Idempotent: some Phase-A dev devices already have is_additional at
    // user_version 24 (see addColumnIfMissing) — re-adding it would throw.
    await addColumnIfMissing(db, 'collection_visits', 'is_additional', 'INTEGER NOT NULL DEFAULT 0');
    currentVersion = 25;
  }

  // B-095 fix (2026-08-08): meeting cards on the two list screens (My
  // Meetings, Manager Meetings) used to show the CLIENT's live status —
  // every card for the same client showed the same, constantly-changing
  // badge (e.g. an old meeting retroactively flipping to "IN PROGRESS" once
  // a later meeting promoted the client). This freezes what the client's
  // status actually was at the moment each meeting was recorded — set once
  // in lib/meeting-service.ts::createMeeting(), never recomputed. Nullable:
  // legacy meetings recorded before this migration have no such record and
  // intentionally show no badge (Vince-approved, 2026-08-08) rather than
  // guessing. Mirrored to Supabase (`meetings.client_status_at_meeting`) via
  // a companion migration in the web repo — see Bugs.md.
  if (currentVersion === 25) {
    await db.execAsync(`
      ALTER TABLE meetings ADD COLUMN client_status_at_meeting TEXT;
    `);
    currentVersion = 26;
  }

  // F-007 Additional Collection Phase B (web migrations 068/069, 2026-08-08):
  // the acknowledgment write-back. `additional_received_at` / `additional_seen_at`
  // MIRROR the two web columns (stamped write-once, server-side, via the
  // collector-only RPCs mark_additional_received / mark_additional_seen — a
  // direct UPDATE is rejected by RLS, so mobile never writes them through the
  // outbox). `additional_seen_pending` is LOCAL-ONLY intent: set to 1 when the
  // collector opens an additional store's screen (possibly offline), then the
  // ack reconciler (lib/sync/additional-acks.ts) calls the seen RPC on the next
  // online pass and clears it. Received needs no local flag — the reconciler
  // drives off `additional_received_at IS NULL`. All additive; a normal row is
  // untouched (received/seen stay NULL, pending 0).
  if (currentVersion === 26) {
    await addColumnIfMissing(db, 'collection_visits', 'additional_received_at', 'TEXT');
    await addColumnIfMissing(db, 'collection_visits', 'additional_seen_at', 'TEXT');
    await addColumnIfMissing(db, 'collection_visits', 'additional_seen_pending', 'INTEGER NOT NULL DEFAULT 0');
    currentVersion = 27;
  }

  // F-007 Partial payment (web migration 070, 2026-08-09): a LOCAL-ONLY outgoing
  // queue for a collector's payments. Because the collector's RLS on the remote
  // `collection_payments` is INSERT-only (no UPDATE), the proof photo URLs must
  // ride IN the insert — so unlike the normal outbox path, a payment is uploaded
  // (photos first) THEN inserted, by its own processor (lib/sync/collection-
  // payments.ts). This table holds the pending payment + its local photo URIs
  // until that lands; `status` is pending|synced|failed. Not an entity-registry
  // table (never pulled/upserted through the generic pipeline). The remote
  // `collection_visits.status='partial'` roll-up (server trigger) is what the
  // UI reads back on the next sync-down — no local partial mirror table needed.
  if (currentVersion === 27) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS collection_payments (
        id TEXT PRIMARY KEY NOT NULL,
        visit_id TEXT NOT NULL,
        collector_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_photo_uri TEXT,
        receipt_photo_uri TEXT,
        payment_photo_url TEXT,
        delivery_receipt_photo_url TEXT,
        gps_lat REAL,
        gps_lng REAL,
        remarks TEXT,
        paid_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_collection_payments_status ON collection_payments (status);
      CREATE INDEX IF NOT EXISTS idx_collection_payments_visit ON collection_payments (visit_id);
    `);
    currentVersion = 28;
  }

  // Tag-Along roster hardening: retain the server's active-state decision in
  // the local snapshot so inactive users cannot reappear from an old cache.
  if (currentVersion === 28) {
    await addColumnIfMissing(db, 'team_roster_snapshot', 'is_active', 'INTEGER NOT NULL DEFAULT 0');
    await db.runAsync('DELETE FROM team_roster_snapshot');
    currentVersion = 29;
  }

  // F-007 Delivery partial COD (web migration 073, 2026-08-09): the delivery twin
  // of the collection_payments queue above. The driver's RLS on the remote
  // `cod_payments` is INSERT-only (no UPDATE), so the proof photo URL rides IN the
  // insert — uploaded (photo first) THEN inserted by its own processor
  // (lib/sync/cod-payments.ts). ONE difference from collection: a payment may only
  // land AFTER the PO's handover (driver_id + time_out) has synced — else the web
  // trigger records the money but leaves status 'pending' (web 073 ordering guard),
  // so the processor gates each insert on the parent PO being locally 'synced'.
  // The remote `purchase_orders.status='partial'` roll-up (server trigger) is what
  // the UI reads back on the next sync-down — no local partial mirror needed.
  if (currentVersion === 29) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cod_payments (
        id TEXT PRIMARY KEY NOT NULL,
        po_id TEXT NOT NULL,
        driver_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_photo_uri TEXT,
        payment_photo_url TEXT,
        gps_lat REAL,
        gps_lng REAL,
        remarks TEXT,
        paid_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cod_payments_status ON cod_payments (status);
      CREATE INDEX IF NOT EXISTS idx_cod_payments_po ON cod_payments (po_id);
    `);
    currentVersion = 30;
  }

  if (currentVersion === 30) {
    await ensureSelfieProofColumns(db);
    currentVersion = 31;
  }

  // Lost Opportunity history (web migration 082, 2026-08-10): a client that
  // becomes `lost` is DELETED from this device by removeLostOrDeletedClient()
  // — that is the correct "remove from the agent's list" behavior and is not
  // changing. But the agent's meetings with that client were collateral: the
  // meeting rows survive (no FK, no cascade), while every read path resolved
  // the company name through `JOIN clients`, so useMeetings had to exclude any
  // meeting whose client row was gone or it would render nameless rows. Net
  // effect, once losses start happening routinely: the agent's whole history
  // with that client silently disappears, and the Reports screen's "Lost"
  // filter can never match anything by construction.
  //
  // Denormalizing the name onto the meeting is how this app already handles
  // the same problem elsewhere — see collection_visits.client_name and
  // purchase_orders.client_name (v12, mirroring web migration 045), and
  // meetings.client_status_at_meeting (v25) for snapshot-on-meeting itself.
  // No new lifecycle state and no new UI, so no ADR-010 wireframe pass.
  //
  // The backfill matters more than it looks: it can only recover names for
  // clients whose rows are still on THIS device. Any client already deleted by
  // an earlier sync is unrecoverable locally, which is why this needs to ship
  // BEFORE web's 082 starts producing losses.
  if (currentVersion === 31) {
    await addColumnIfMissing(db, 'meetings', 'client_name', 'TEXT');
    await db.runAsync(`
      UPDATE meetings SET client_name = (
        SELECT company_name FROM clients WHERE clients.id = meetings.client_id
      )
      WHERE client_name IS NULL AND client_id IS NOT NULL
    `);
    currentVersion = 32;
  }

  // Joint Manager record-holder mirrors (web migration 091). Requests and
  // decisions are local read models; only request creation is queued through
  // the normal outbox. Holder rows are server-authoritative sync-down data.
  if (currentVersion === 32) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS joint_manager_requests (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT NOT NULL,
        requester_id TEXT NOT NULL,
        origin_team_id TEXT,
        manager_ids TEXT NOT NULL,
        action_kind TEXT NOT NULL,
        action_payload TEXT NOT NULL DEFAULT '{}',
        base_updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        required_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        applied_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        sync_error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_joint_manager_requests_requester ON joint_manager_requests(requester_id);
      CREATE INDEX IF NOT EXISTS idx_joint_manager_requests_client ON joint_manager_requests(client_id);
      CREATE TABLE IF NOT EXISTS joint_manager_request_decisions (
        id TEXT PRIMARY KEY NOT NULL,
        request_id TEXT NOT NULL,
        manager_id TEXT NOT NULL,
        decision TEXT NOT NULL DEFAULT 'pending',
        decided_at TEXT,
        synced_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_joint_manager_decisions_request ON joint_manager_request_decisions(request_id);
      CREATE TABLE IF NOT EXISTS client_record_holders (
        client_id TEXT NOT NULL,
        manager_id TEXT NOT NULL,
        manager_name TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        origin_team_id TEXT,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (client_id, manager_id)
      );
    `);
    currentVersion = 33;
  }

  if (currentVersion === 33) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS manager_directory_snapshot (
        profile_id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        team_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        synced_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_manager_directory_active ON manager_directory_snapshot(is_active);
    `);
    currentVersion = 34;
  }

  // Company identity v2: spacing and punctuation no longer let a user bypass
  // the duplicate check (for example, "Test 1" and "test1"). Rebuild both
  // local mirrors from the shared normalizer; never delete or merge records.
  if (currentVersion === 34) {
    const existingClients = await db.getAllAsync<{ id: string; company_name: string }>(
      'SELECT id, company_name FROM clients'
    );
    for (const client of existingClients) {
      await db.runAsync('UPDATE clients SET normalized_name = ? WHERE id = ?', [
        normalizeCompanyName(client.company_name),
        client.id,
      ]);
    }

    const snapshotRows = await db.getAllAsync<{ client_id: string; company_name: string }>(
      'SELECT client_id, company_name FROM company_names_snapshot'
    );
    for (const snapshot of snapshotRows) {
      await db.runAsync('UPDATE company_names_snapshot SET normalized_name = ? WHERE client_id = ?', [
        normalizeCompanyName(snapshot.company_name),
        snapshot.client_id,
      ]);
    }
    currentVersion = 35;
  }

  // Batch 3: retain offline/two-device PO evidence that loses the current
  // client/cycle race as an explicit local-only state. This status never
  // leaves SQLite and is not part of the remote enum.
  if (currentVersion === 35) {
    await db.execAsync(`
      CREATE TABLE po_confirmation_requests_new (
        id TEXT PRIMARY KEY NOT NULL, client_id TEXT NOT NULL, cycle_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL, requester_id TEXT NOT NULL, po_photo_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled', 'duplicate_blocked')),
        decided_by TEXT, decided_at TEXT, decision_note TEXT, created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL, synced_at TEXT
      );
      INSERT INTO po_confirmation_requests_new SELECT * FROM po_confirmation_requests;
      DROP TABLE po_confirmation_requests;
      ALTER TABLE po_confirmation_requests_new RENAME TO po_confirmation_requests;
      CREATE INDEX idx_po_confirmation_meeting ON po_confirmation_requests (meeting_id);
      CREATE INDEX idx_po_confirmation_requester ON po_confirmation_requests (requester_id, status);
      CREATE INDEX idx_po_confirmation_client ON po_confirmation_requests (client_id);
    `);
    currentVersion = 36;
  }

  // Keep this unconditional as a final defensive check for databases that
  // traversed an older path with a partially-applied v30 block.
  await ensureSelfieProofColumns(db);
  await ensureCriticalTablesExist(db);
  await ensureRemittanceLinkColumns(db);
  await ensureJointManagerTablesExist(db);
  await retireLegacyJointManagerData(db);

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}

/**
 * 2026-08-09 fix (Save Error: "cannot rollback - no transaction is active" /
 * "cannot start a transaction within a transaction" on PO-evidence save
 * racing `[sync-down] client cycles pull`): `getDb()` returns one singleton
 * connection reused by every caller — the sync engine (`processOutbox`,
 * `syncDown`, `syncAgendaPolicyAndCycles`) AND UI write paths like
 * `meeting-service.ts::createMeeting()` all call `getDb()` and get the SAME
 * native connection, not two separate ones. expo-sqlite's
 * `withTransactionAsync` does a raw BEGIN/task/COMMIT with no built-in
 * mutex, so two callers on this one connection can genuinely race: whichever
 * BEGIN loses finds a transaction already open (nested-BEGIN error) or later
 * finds its own transaction gone when it tries to ROLLBACK. The retry logic
 * in `lib/sync/with-transaction-retry.ts` (kept, still useful for other
 * transient cases) treats the symptom; this queues every
 * `withTransactionAsync` call on THIS connection so only one is ever in
 * flight at a time, removing the race itself. Deliberately not applied to
 * plain `runAsync`/`getAllAsync` calls outside a transaction — those don't
 * hold the writer lock long enough to nest.
 */
function serializeTransactions(db: SQLiteDatabase): SQLiteDatabase {
  const originalWithTransactionAsync = db.withTransactionAsync.bind(db);
  let queue: Promise<void> = Promise.resolve();
  db.withTransactionAsync = (task: () => Promise<void>): Promise<void> => {
    const run = queue.then(() => originalWithTransactionAsync(task));
    // Chain the next caller off this attempt regardless of outcome — a
    // failed transaction must not permanently block the queue for everyone
    // after it, but this function's own return value/rejection must still
    // reach ITS caller untouched.
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
  return db;
}

let dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * B-110 (2026-08-10): the app's ONE native SQLite connection — used directly
 * by code outside the React tree (T-002 sync engine, background tasks) AND
 * republished into React via `lib/app-db-provider.tsx`'s `AppDbProvider`/
 * `useAppDb()` (replaces expo-sqlite's own `<SQLiteProvider>`/
 * `useSQLiteContext()`, which used to open a SECOND, entirely independent
 * native connection to the same file — see `app-db-provider.tsx`'s header
 * comment for the full incident). Every screen/hook should call `useAppDb()`;
 * `getDb()` itself is for non-React callers only.
 */
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await migrateDbIfNeeded(db);
      return serializeTransactions(db);
    });
  }
  return dbPromise;
}
