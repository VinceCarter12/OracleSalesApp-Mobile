import { getDb } from './db';
import { uuidv4 } from './uuid';
import { normalizeCompanyName } from './company-name';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import { isLikelyOnline } from './sync/connectivity';
import { toRemoteCustomerType, toRemoteSalesChannel, toRemoteStatus } from './remote-client-mapping';
import { rowToClient, type LocalClientRow } from './local-client-mapper';
import { checkCompanyNameDuplicate, DuplicateCompanyNameError } from './client-duplicate-check';
import type { SalesChannel, Client } from '../types';

// T-005: single write path for client creation — both Create Client
// (app/(tabs)/clients/create.tsx) and Record Meeting's meeting-first branch
// (app/(tabs)/meetings/record.tsx) go through this, so dup-check + the
// local-first write + outbox enqueue only exist in one place. Duplicate-name
// lookup logic itself lives in lib/client-duplicate-check.ts (split out to
// stay under the 300-line file limit — see that file's header comment);
// re-exported below for existing consumers (app/(tabs)/clients/create.tsx).
export {
  checkLocalDuplicate,
  checkCompanyNameDuplicate,
  DuplicateCompanyNameError,
  type DuplicateCheckResult,
} from './client-duplicate-check';

export interface CreateClientInput {
  companyName: string;
  city: string;
  agentId: string;
  contactPerson?: string;
  position?: string | null;
}

/**
 * Local-first client creation (ADR-001/002/004): dup-check, then one SQLite
 * transaction for the `clients` insert + its `outbox` row (so a crash
 * between the two can never strand a client without a queued push), then a
 * best-effort immediate sync. Throws `DuplicateCompanyNameError` if a
 * confirmed duplicate is found — 'unknown' (offline, live check failed) is
 * allowed through, same as before, since the server unique constraint
 * (Migration 014) is the final authority at sync time either way.
 */
export async function createClient(input: CreateClientInput): Promise<string> {
  const companyName = input.companyName.trim();
  const city = input.city.trim();
  const dupResult = await checkCompanyNameDuplicate(companyName, city);
  if (dupResult === 'duplicate') {
    throw new DuplicateCompanyNameError(companyName);
  }

  const db = await getDb();
  const id = uuidv4();
  const outboxId = uuidv4();
  const now = new Date().toISOString();
  const normalized = normalizeCompanyName(companyName);
  const contactPerson = input.contactPerson?.trim() ?? '';
  // 2026-07-21: info-completion deadline ("1-month rule", client-progress.ts's
  // comment) — computed HERE at creation time, not by a later trigger,
  // because it's a static value assigned once and never re-derived from
  // cross-device state (unlike ADR-027's prospect→new promotion, which IS a
  // server-side trigger because it reacts to async, possibly-cross-device
  // conditions — this doesn't have that race). Migration-021 mirrors this
  // exact formula server-side (for manager-created clients + backfilling
  // pre-existing rows), so local and remote never disagree.
  const DEADLINE_DAYS = 30;
  const detailsDeadlineAt = new Date(Date.now() + DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // Local SQLite keeps mobile's own domain-format values (matches what the
  // UI/`Client` type expects when read back); only the outbox payload sent
  // to Supabase needs the remote column names/casing (lib/remote-client-mapping.ts).
  const localStatus = 'prospect' as const;
  const localSalesChannel = 'Distributor' as const;

  // Remote column names/values differ from mobile's local ones in three
  // places, confirmed against the live Supabase migrations (2026-07-15):
  // `assigned_agent_id` (not `agent_id`), `contact_position` (not
  // `position`), and `customer_type`/`status` split differently than
  // mobile's single local `status` field — see lib/remote-client-mapping.ts.
  const remotePayload = {
    id,
    company_name: companyName,
    city,
    contact_person: contactPerson,
    contact_position: input.position ?? null,
    contact_number: null,
    office_address: null,
    customer_type: toRemoteCustomerType(localStatus),
    sales_channel: toRemoteSalesChannel(localSalesChannel),
    status: toRemoteStatus(localStatus),
    assigned_agent_id: input.agentId,
    created_at: now,
    updated_at: now,
    details_deadline_at: detailsDeadlineAt,
  };

  const createdOnline = await isLikelyOnline();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO clients
        (id, company_name, normalized_name, city, contact_person, position, customer_type,
         sales_channel, status, agent_id, created_at, updated_at, details_deadline_at, sync_status, local_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id,
        companyName,
        normalized,
        city,
        contactPerson,
        remotePayload.contact_position,
        // Local `customer_type` mirrors mobile's legacy Dealer-type field,
        // unused by any real logic (types/index.ts) — left null rather than
        // storing a value that means something different remotely.
        null,
        localSalesChannel,
        localStatus,
        input.agentId,
        now,
        now,
        detailsDeadlineAt,
        now,
      ]
    );
    await enqueueOutboxRow(db, {
      outboxId,
      recordId: id,
      tableName: 'clients',
      operation: 'insert',
      payload: JSON.stringify(remotePayload),
      createdAt: now,
      createdOnline,
    });
  });

  // Best-effort immediate push; if offline this silently no-ops and the
  // outbox row waits for use-sync.ts's reconnect listener.
  runSync(input.agentId).catch((err) => console.error('[client-service] background sync failed:', JSON.stringify(err, null, 2)));

  return id;
}

export interface UpdateClientInfoInput {
  clientId: string;
  agentId: string;
  contactPerson: string;
  position: string;
  contactNumber: string;
  officeAddress: string;
  salesChannel: SalesChannel;
}

/**
 * Complete/Edit Info (Wireframe a-complete, F-001 Phase B / F-002): local-first
 * update + outbox enqueue, same pattern as createClient(). Status is never
 * agent-chosen here (2026-07-19 rule correction) — this only stamps
 * `details_completed_at` (first save only) and leaves `status` untouched.
 *
 * The prospect→new promotion itself (ADR-027) is deliberately NOT done here
 * or anywhere on-device — ADR-006 requires lifecycle automations to run
 * server-side (a Postgres trigger, see Migration-017-Report.md), since a
 * per-device check can miss the transition entirely when the two
 * conditions (completed info, a Successful meeting) are satisfied by writes
 * from two different devices/agents. `details_completed_at` synced up via
 * the outbox below is exactly the input the server trigger evaluates; the
 * resulting `status='new'` flows back down through the normal sync-down
 * pull once the trigger fires remotely.
 */
export async function updateClientInfo(input: UpdateClientInfoInput): Promise<void> {
  const db = await getDb();
  const outboxId = uuidv4();
  const now = new Date().toISOString();
  const contactPerson = input.contactPerson.trim();
  const position = input.position.trim() || null;
  const contactNumber = input.contactNumber.trim() || null;
  const officeAddress = input.officeAddress.trim() || null;

  const existing = await db.getFirstAsync<{ details_completed_at: string | null }>(
    'SELECT details_completed_at FROM clients WHERE id = ?',
    [input.clientId]
  );
  const detailsCompletedAt = existing?.details_completed_at ?? now;

  const remotePayload = {
    id: input.clientId,
    // B-041/B-044: this update reaches Supabase via a genuine UPDATE now
    // (lib/sync/remote-upsert.ts::updateOne, keyed off the outbox row's
    // `operation`), not an upsert-as-insert — so the UPDATE policy's
    // USING/WITH CHECK is what actually applies here, not an INSERT branch.
    // Kept regardless: it's the correct current owner, satisfies the update
    // policy, and is a harmless idempotent re-set to its existing value.
    assigned_agent_id: input.agentId,
    contact_person: contactPerson,
    contact_position: position,
    contact_number: contactNumber,
    office_address: officeAddress,
    sales_channel: toRemoteSalesChannel(input.salesChannel),
    details_completed_at: detailsCompletedAt,
    updated_at: now,
  };

  const createdOnline = await isLikelyOnline();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE clients
        SET contact_person = ?, position = ?, contact_number = ?, office_address = ?,
            sales_channel = ?, details_completed_at = ?, updated_at = ?, local_updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [contactPerson, position, contactNumber, officeAddress, input.salesChannel, detailsCompletedAt, now, now, input.clientId]
    );
    await enqueueOutboxRow(db, {
      outboxId,
      recordId: input.clientId,
      tableName: 'clients',
      operation: 'update',
      payload: JSON.stringify(remotePayload),
      createdAt: now,
      createdOnline,
    });
  });

  runSync(input.agentId).catch((err) => console.error('[client-service] background sync failed:', JSON.stringify(err, null, 2)));
}

/**
 * ADR-026 P2 item 8: single shared client-by-id lookup, replacing the
 * inline `SELECT * FROM clients WHERE id = ?` duplicated across 4 screens.
 * Local SQLite is the primary read path (ADR-001/T-003) — a `pending`
 * (not-yet-synced) client only ever exists here until the outbox pushes it.
 */
export async function getClientById(clientId: string): Promise<Client | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<LocalClientRow>('SELECT * FROM clients WHERE id = ?', [clientId]);
  return row ? rowToClient(row) : null;
}

// T-014 (ADR-022 #12): non-blocking duplicate-name/phone warnings live in
// lib/client-similarity.ts — split out to stay under the 300-line limit.
export { checkSimilarCompanyWarnings, type SimilarCompanyWarnings } from './client-similarity';
