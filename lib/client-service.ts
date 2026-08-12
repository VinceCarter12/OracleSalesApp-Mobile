import { getDb } from './db';
import { uuidv4 } from './uuid';
import { normalizeCompanyName } from './company-name';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import { isLikelyOnline } from './sync/connectivity';
import { toRemoteCustomerType, toRemoteSalesChannel, toRemoteStatus } from './remote-client-mapping';
import { rowToClient, type LocalClientRow } from './local-client-mapper';
import { checkCompanyNameDuplicate, DuplicateCompanyNameError } from './client-duplicate-check';
import { verifyAccountActive, AccountSuspendedError } from './app-lock/account-status';
import { resolveClientInfoUpdate, type ExistingClientInfoRow } from './client-info-update';
import type { SalesChannel, Client } from '../types';

// Batch 5 Slice 2 (ADR-051): short budget so a suspension check never delays an offline field write — must fail open fast.
const SENSITIVE_WRITE_CHECK_TIMEOUT_MS = 2500;

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
  // Batch 5 Slice 2 (ADR-051) trigger point 2: fail-open on 'active'/
  // 'unverified'; only a confirmed 'suspended' blocks the write.
  const accountStatus = await verifyAccountActive(input.agentId, SENSITIVE_WRITE_CHECK_TIMEOUT_MS);
  if (accountStatus === 'suspended') {
    throw new AccountSuspendedError();
  }

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
  // B-0xx fix (2026-08-09): was hardcoded to 'Distributor', which made the
  // info-completion checklist's "Sales channel" item read as done for every
  // brand-new client even though nobody picked one — left null until the
  // agent actually chooses one in Complete Info (Wireframe-Sales-BizLink.html
  // a-complete; Create Client never asks for this field).
  const localSalesChannel: SalesChannel | null = null;

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
  salesChannel: SalesChannel | null;
  // ADR-052 (Batch 6 Phase 5): approval-EXEMPT field — always settable
  // directly through this function regardless of role, never through
  // `lib/client-edit-request-service.ts::createClientEditRequest()`. No UI
  // sets this yet (Phase 8's job); optional so every existing caller of
  // `updateClientInfo()` keeps compiling unchanged.
  minorNotes?: string | null;
  // Batch 6 PR D: same "undefined preserves the current value" rule as
  // minorNotes above (see lib/client-info-update.ts::resolveClientInfoUpdate).
  companyName?: string;
  // Wireframe-Sales-BizLink ~line 623's "Existing client" tile — one-way
  // flag only, never reverts an already-'existing' client back down.
  markExisting?: boolean;
  /** ADR-052 manager self-edit local version guard. */
  expectedUpdatedAt?: string;
}

export class ClientUpdateConflictError extends Error {
  constructor() {
    super('This client changed on another device. Refresh the client and try again.');
    this.name = 'ClientUpdateConflictError';
  }
}

/**
 * Complete/Edit Info (Wireframe a-complete, F-001 Phase B / F-002): local-first
 * update + outbox enqueue, same pattern as createClient(). Status is never
 * agent-chosen here (2026-07-19 rule correction) except via the explicit
 * one-way `markExisting` override (Batch 6 PR D) — this otherwise only
 * stamps `details_completed_at` (first save only) and leaves `status` alone.
 *
 * The prospect→new promotion itself (ADR-027) is deliberately NOT done here
 * or anywhere on-device — ADR-006 requires lifecycle automations to run
 * server-side (a Postgres trigger, see Migration-017-Report.md), since a
 * per-device check can miss the transition entirely across devices.
 * `details_completed_at` synced up via the outbox below is exactly the
 * input the server trigger evaluates; the resulting `status='new'` flows
 * back down through the normal sync-down pull once the trigger fires.
 */
export async function updateClientInfo(input: UpdateClientInfoInput): Promise<void> {
  // Batch 5 Slice 2 (ADR-051) trigger point 2: fail-open on 'active'/
  // 'unverified'; only a confirmed 'suspended' blocks the write.
  const accountStatus = await verifyAccountActive(input.agentId, SENSITIVE_WRITE_CHECK_TIMEOUT_MS);
  if (accountStatus === 'suspended') {
    throw new AccountSuspendedError();
  }

  const db = await getDb();
  const outboxId = uuidv4();
  const now = new Date().toISOString();
  const contactPerson = input.contactPerson.trim();
  const position = input.position.trim() || null;
  const contactNumber = input.contactNumber.trim() || null;
  const officeAddress = input.officeAddress.trim() || null;

  const existing = await db.getFirstAsync<ExistingClientInfoRow>(
    'SELECT details_completed_at, minor_notes, company_name, status FROM clients WHERE id = ?',
    [input.clientId]
  );
  const resolved = resolveClientInfoUpdate(input, existing, now);

  const remotePayload = {
    id: input.clientId,
    // B-041/B-044: this update reaches Supabase via a genuine UPDATE now
    // (lib/sync/remote-upsert.ts::updateOne, keyed off the outbox row's
    // `operation`), not an upsert-as-insert — so the UPDATE policy's
    // USING/WITH CHECK is what actually applies here, not an INSERT branch.
    // Kept regardless: it's the correct current owner, satisfies the update
    // policy, and is a harmless idempotent re-set to its existing value.
    assigned_agent_id: input.agentId,
    company_name: resolved.companyName,
    contact_person: contactPerson,
    contact_position: position,
    contact_number: contactNumber,
    office_address: officeAddress,
    sales_channel: toRemoteSalesChannel(input.salesChannel),
    // Same "harmless idempotent re-set" reasoning as assigned_agent_id above
    // when markExisting wasn't passed this call — mirrors whatever status
    // already exists remotely (never regresses a stage, see toRemoteCustomerType).
    customer_type: resolved.customerType,
    details_completed_at: resolved.detailsCompletedAt,
    minor_notes: resolved.minorNotes,
    updated_at: now,
  };

  const createdOnline = await isLikelyOnline();

  await db.withTransactionAsync(async () => {
    const updateResult = await db.runAsync(
      `UPDATE clients
        SET company_name = ?, normalized_name = ?, contact_person = ?, position = ?, contact_number = ?, office_address = ?,
            sales_channel = ?, status = ?, details_completed_at = ?, minor_notes = ?, updated_at = ?, local_updated_at = ?, sync_status = 'pending'
       WHERE id = ?${input.expectedUpdatedAt !== undefined ? ' AND updated_at = ?' : ''}`,
      [
        resolved.companyName,
        resolved.normalizedName,
        contactPerson,
        position,
        contactNumber,
        officeAddress,
        input.salesChannel,
        resolved.status,
        resolved.detailsCompletedAt,
        resolved.minorNotes,
        now,
        now,
        input.clientId,
        ...(input.expectedUpdatedAt !== undefined ? [input.expectedUpdatedAt] : []),
      ]
    );
    if (input.expectedUpdatedAt !== undefined && updateResult.changes !== 1) {
      throw new ClientUpdateConflictError();
    }
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

// Batch 4 (2026-07-29): permanent client office pin write path lives in
// lib/office-pin-service.ts — split out to stay under the 300-line limit,
// same reason as the two re-exports above. Re-exported here for existing
// consumers (app/(tabs)/clients/office-location.tsx).
export {
  writeOfficePinLocal,
  setOfficeLocation,
  hasOfficePin,
  type OfficePinSource,
  type SetOfficeLocationInput,
} from './office-pin-service';
