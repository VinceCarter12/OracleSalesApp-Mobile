import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from './db';
import { uuidv4 } from './uuid';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import { isLikelyOnline } from './sync/connectivity';

export { hasOfficePin } from './policies/office-pin-policy';

// Batch 4 (2026-07-29): the permanent client office pin is a property of the
// client record, not of any one meeting — see
// [[Office-Location-Spec-2026-07-29]]. A meeting's own GPS remains immutable
// visit evidence (`meetings.gps_lat`/`gps_lng`) and must never be treated as
// the office pin except through the explicit Client Office auto-capture path
// below. Split out of client-service.ts to stay under the 300-line file
// limit — same reason client-duplicate-check.ts/client-similarity.ts were
// split out (see client-service.ts's own header comment); re-exported from
// there for existing/future consumers.

export type OfficePinSource = 'manual' | 'client_office_meeting';

export interface SetOfficeLocationInput {
  clientId: string;
  agentId: string;
  lat: number;
  lng: number;
  source: OfficePinSource;
  /** Defaults to "now" — pass the meeting's own `logged_at` for the Client Office auto-capture path so the pin's captured-at matches the meeting, not the moment the outbox row happens to be built. */
  capturedAt?: string;
}

/**
 * Transaction-less core write: one `clients` UPDATE + its outbox row. Must
 * be called from INSIDE a transaction the caller already owns — expo-sqlite
 * cannot nest `withTransactionAsync` calls. Used by `setOfficeLocation()`
 * below (manual flow, owns its own transaction) and by
 * `lib/meeting-service.ts::createMeeting()` (Client Office meeting
 * auto-capture, reuses `createMeeting()`'s existing transaction instead of
 * opening a second one).
 */
export async function writeOfficePinLocal(db: SQLiteDatabase, input: SetOfficeLocationInput): Promise<void> {
  const now = new Date().toISOString();
  const capturedAt = input.capturedAt ?? now;
  const outboxId = uuidv4();
  // Link-level check only (B-027's "not a full backend probe" — see
  // lib/sync/connectivity.ts), safe to call inside an open transaction.
  const createdOnline = await isLikelyOnline();

  await db.runAsync(
    `UPDATE clients
      SET office_lat = ?, office_lng = ?, office_pin_source = ?, office_pin_updated_at = ?,
          updated_at = ?, local_updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [input.lat, input.lng, input.source, capturedAt, now, now, input.clientId]
  );

  // B-041/B-044: this reaches Supabase via a genuine UPDATE
  // (lib/sync/remote-upsert.ts::updateOne, keyed off the outbox row's
  // `operation`), so the UPDATE policy's USING/WITH CHECK is what actually
  // applies — `assigned_agent_id` is re-sent for the same reason
  // `updateClientInfo()` does (lib/client-service.ts): it's the correct
  // current owner, satisfies the WITH CHECK, and is a harmless idempotent
  // re-set to its existing value.
  const remotePayload = {
    id: input.clientId,
    assigned_agent_id: input.agentId,
    office_lat: input.lat,
    office_lng: input.lng,
    office_pin_source: input.source,
    office_pin_updated_at: capturedAt,
    updated_at: now,
  };

  await enqueueOutboxRow(db, {
    outboxId,
    recordId: input.clientId,
    tableName: 'clients',
    operation: 'update',
    payload: JSON.stringify(remotePayload),
    createdAt: now,
    createdOnline,
  });
}

/**
 * Public API for the MANUAL Set/Update Office Location flow
 * (app/(tabs)/clients/office-location.tsx). Owns its own transaction
 * wrapping the same core write as `writeOfficePinLocal()`, then a
 * best-effort immediate sync — same pattern as
 * `client-service.ts::updateClientInfo()`.
 */
export async function setOfficeLocation(input: SetOfficeLocationInput): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await writeOfficePinLocal(db, input);
  });

  runSync(input.agentId).catch((err) =>
    console.error('[office-pin-service] background sync failed:', err instanceof Error ? err.message : String(err))
  );
}
