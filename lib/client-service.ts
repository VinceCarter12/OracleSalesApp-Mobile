import { getDb } from './db';
import { supabase } from './supabase';
import { withTimeout } from './with-timeout';
import { uuidv4 } from './uuid';
import { normalizeCompanyName } from './company-name';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import { toRemoteCustomerType, toRemoteSalesChannel, toRemoteStatus } from './remote-client-mapping';
import type { SalesChannel } from '../types';

// T-005: single write path for client creation — both Create Client
// (app/(tabs)/clients/create.tsx) and Record Meeting's meeting-first branch
// (app/(tabs)/meetings/record.tsx) go through this, so dup-check + the
// local-first write + outbox enqueue only exist in one place.

const LIVE_CHECK_TIMEOUT_MS = 8000;

export type DuplicateCheckResult = 'duplicate' | 'available' | 'unknown';

export class DuplicateCompanyNameError extends Error {
  constructor(companyName: string) {
    super(`A client named "${companyName}" already exists.`);
    this.name = 'DuplicateCompanyNameError';
  }
}

/**
 * Checks, in order: (a) local `clients` rows in ANY sync state — including
 * this device's own not-yet-synced writes, which the pre-T-005 check never
 * looked at, (b) the read-only company-name snapshot cache, (c) a live
 * Supabase check if online. City is collected at Create Client itself
 * (2026-07-15 revision — an agent always knows the city they're in), so
 * this is a hard (name, city) check, not a deferred soft warning.
 */
export async function checkCompanyNameDuplicate(
  companyName: string,
  city: string | null,
  excludeClientId?: string
): Promise<DuplicateCheckResult> {
  const normalized = normalizeCompanyName(companyName);
  if (!normalized) return 'available';

  const db = await getDb();
  const excludeId = excludeClientId ?? '';

  const localMatch = await db.getFirstAsync<{ id: string }>(
    city
      ? 'SELECT id FROM clients WHERE normalized_name = ? AND city = ? AND id != ? LIMIT 1'
      : 'SELECT id FROM clients WHERE normalized_name = ? AND id != ? LIMIT 1',
    city ? [normalized, city, excludeId] : [normalized, excludeId]
  );
  if (localMatch) return 'duplicate';

  const snapshotMatch = await db.getFirstAsync<{ client_id: string }>(
    'SELECT client_id FROM company_names_snapshot WHERE normalized_name = ? AND client_id != ? LIMIT 1',
    [normalized, excludeId]
  );
  if (snapshotMatch) return 'duplicate';

  return liveDuplicateCheck(normalized, city, excludeClientId);
}

/**
 * Queries the (not-yet-applied) generated `normalized_company_name` column —
 * correct once Migration-014-Report.md lands. Until then Postgres rejects
 * the unknown column and this degrades to 'unknown', which callers treat as
 * "can't confirm, fall back to the local-only result".
 */
async function liveDuplicateCheck(
  normalized: string,
  city: string | null,
  excludeClientId?: string
): Promise<DuplicateCheckResult> {
  try {
    let query = supabase.from('clients').select('id').eq('normalized_company_name', normalized);
    if (city) query = query.eq('city', city);
    const { data, error } = await withTimeout(
      Promise.resolve(query.limit(5)),
      LIVE_CHECK_TIMEOUT_MS,
      'client duplicate live check'
    );
    if (error) throw error;
    const matches = (data ?? []).filter((row) => row.id !== excludeClientId);
    return matches.length > 0 ? 'duplicate' : 'available';
  } catch {
    return 'unknown';
  }
}

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
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO clients
        (id, company_name, normalized_name, city, contact_person, position, customer_type,
         sales_channel, status, agent_id, created_at, updated_at, sync_status, local_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
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
 * update + outbox enqueue, same pattern as createClient() — this used to be a
 * direct Supabase `.update()` keyed off a row that may not exist there yet
 * for a not-yet-synced local client, throwing "Cannot coerce the result to a
 * single JSON object" on the *read* side (complete.tsx's old `.single()`
 * fetch) before this write path was ever reached.
 */
export async function updateClientInfo(input: UpdateClientInfoInput): Promise<void> {
  const db = await getDb();
  const outboxId = uuidv4();
  const now = new Date().toISOString();
  const contactPerson = input.contactPerson.trim();
  const position = input.position.trim() || null;
  const contactNumber = input.contactNumber.trim() || null;
  const officeAddress = input.officeAddress.trim() || null;

  const remotePayload = {
    id: input.clientId,
    contact_person: contactPerson,
    contact_position: position,
    contact_number: contactNumber,
    office_address: officeAddress,
    sales_channel: toRemoteSalesChannel(input.salesChannel),
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE clients
        SET contact_person = ?, position = ?, contact_number = ?, office_address = ?,
            sales_channel = ?, updated_at = ?, local_updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [contactPerson, position, contactNumber, officeAddress, input.salesChannel, now, now, input.clientId]
    );
    await enqueueOutboxRow(db, {
      outboxId,
      recordId: input.clientId,
      tableName: 'clients',
      operation: 'update',
      payload: JSON.stringify(remotePayload),
      createdAt: now,
    });
  });

  runSync(input.agentId).catch((err) => console.error('[client-service] background sync failed:', JSON.stringify(err, null, 2)));
}

// T-014 (ADR-022 #12): non-blocking duplicate-name/phone warnings live in
// lib/client-similarity.ts — split out to stay under the 300-line limit.
export { checkSimilarCompanyWarnings, type SimilarCompanyWarnings } from './client-similarity';
