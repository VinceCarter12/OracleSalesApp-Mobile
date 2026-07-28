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
const LATEST_SCHEMA_VERSION = 17;

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
