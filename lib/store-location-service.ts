import { getDb } from './db';
import { uuidv4 } from './uuid';
import { assertOfficePinCoordinateWithinPhilippines } from './office-pin-service';

// Store Locations (C&D maps, 2026-08-17): local-first writes for a store's
// NUMBERED relocation list. A field officer standing at a moved store appends
// "Location N" and it immediately becomes the current pin — no admin approval
// (owner decision 2026-08-17). Reuses office-pin-service's Philippines
// coordinate guard so a store pin can never be written outside the country,
// exactly like the office-pin flow.
//
// ⚠️ LOCAL ONLY for now: rows are written with sync_status='pending' but NOT yet
// enqueued to the outbox, because the web-owned `client_locations` table +
// regenerated types don't exist yet (see STORE_LOCATIONS_CONTRACT.md). Once web
// ships it, a processor/outbox lane pushes these up — the pending marker is the
// hook for that. Until then a set location lives on the setting device only.

export interface StoreLocation {
  id: string;
  clientId: string;
  /** 1-based position — "Location 1", "Location 2", … in the order they were added. */
  seq: number;
  label: string | null;
  lat: number;
  lng: number;
  isCurrent: boolean;
  /**
   * What the officer meant this pin to be (owner decision 2026-08-22):
   * - 'relocation' — the SAME store moved here; becomes current + overrides area.
   * - 'additional_branch' — a SEPARATE second store; non-current flagged entry,
   *   never becomes the current pin, never overrides the registered area.
   */
  kind: 'relocation' | 'additional_branch';
  /** field_set (officer on the ground) | office_pin | admin | migrated. */
  source: string;
  setBy: string | null;
  setByName: string | null;
  capturedAt: string;
  /** Optional municipality (PSGC name) the officer picked — overrides the store's registered city in the header. */
  area: string | null;
  /** Province of the picked municipality — replaces the header's hardcoded ", Bataan". */
  province: string | null;
}

interface StoreLocationRow {
  id: string;
  client_id: string;
  seq: number;
  label: string | null;
  lat: number;
  lng: number;
  is_current: number;
  kind: string;
  source: string;
  set_by: string | null;
  set_by_name: string | null;
  captured_at: string;
  area: string | null;
  province: string | null;
}

function rowToStoreLocation(row: StoreLocationRow): StoreLocation {
  return {
    id: row.id,
    clientId: row.client_id,
    seq: row.seq,
    label: row.label,
    lat: row.lat,
    lng: row.lng,
    isCurrent: row.is_current === 1,
    kind: row.kind === 'additional_branch' ? 'additional_branch' : 'relocation',
    source: row.source,
    setBy: row.set_by,
    setByName: row.set_by_name,
    capturedAt: row.captured_at,
    area: row.area,
    province: row.province,
  };
}

/** All saved locations for a store, oldest (Location 1) first. */
export async function listStoreLocations(clientId: string): Promise<StoreLocation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<StoreLocationRow>(
    'SELECT * FROM client_locations WHERE client_id = ? ORDER BY seq ASC',
    [clientId]
  );
  return rows.map(rowToStoreLocation);
}

/** The store's current pin, or null if none has been set on this device yet. */
export async function getCurrentStoreLocation(clientId: string): Promise<StoreLocation | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<StoreLocationRow>(
    'SELECT * FROM client_locations WHERE client_id = ? AND is_current = 1 LIMIT 1',
    [clientId]
  );
  return row ? rowToStoreLocation(row) : null;
}

export interface AddStoreLocationInput {
  clientId: string;
  lat: number;
  lng: number;
  /**
   * 'relocation' (default) — the store moved here: this pin becomes current and
   * its area overrides the store header. 'additional_branch' — a separate second
   * store at this client: saved as a NON-current, flagged entry that does not
   * move the store's current pin or its registered area.
   */
  kind?: 'relocation' | 'additional_branch';
  label?: string | null;
  setBy?: string | null;
  setByName?: string | null;
  /** Optional municipality (PSGC name) the officer picked — shown in the store header in place of the registered city. */
  area?: string | null;
  /** Province of the picked municipality — replaces the header's hardcoded ", Bataan". */
  province?: string | null;
  /** Defaults to "now" — the moment the officer set the pin. */
  capturedAt?: string;
}

/**
 * Appends a new location as the next "Location N".
 *
 * - kind='relocation' (default): the store moved here — this pin becomes the
 *   current one (demoting whatever was current), and its area (if picked)
 *   overrides the store header.
 * - kind='additional_branch': a SEPARATE second store at this client — saved as
 *   a NON-current, flagged entry. It does NOT demote the current pin and never
 *   overrides the registered area (a branch is not the account; web decides if
 *   it becomes a real account — see STORE_LOCATIONS_CONTRACT.md §area+branch).
 *
 * Single transaction so a relocation's demote + insert can't leave two currents.
 * Returns the created record for optimistic UI.
 */
export async function addStoreLocation(input: AddStoreLocationInput): Promise<StoreLocation> {
  assertOfficePinCoordinateWithinPhilippines(input.lat, input.lng);

  const kind = input.kind === 'additional_branch' ? 'additional_branch' : 'relocation';
  const isCurrent = kind === 'relocation';
  const db = await getDb();
  const now = new Date().toISOString();
  const capturedAt = input.capturedAt ?? now;
  const id = uuidv4();
  let created: StoreLocation | null = null;

  await db.withTransactionAsync(async () => {
    const maxRow = await db.getFirstAsync<{ maxSeq: number | null }>(
      'SELECT MAX(seq) AS maxSeq FROM client_locations WHERE client_id = ?',
      [input.clientId]
    );
    const seq = (maxRow?.maxSeq ?? 0) + 1;

    // A branch is never current, so it must not demote the store's real pin.
    if (isCurrent) {
      await db.runAsync(
        "UPDATE client_locations SET is_current = 0, local_updated_at = ? WHERE client_id = ? AND is_current = 1",
        [now, input.clientId]
      );
    }
    await db.runAsync(
      `INSERT INTO client_locations
        (id, client_id, seq, label, lat, lng, is_current, kind, source, set_by, set_by_name, captured_at, created_at, local_updated_at, sync_status, area, province)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'field_set', ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, input.clientId, seq, input.label ?? null, input.lat, input.lng, isCurrent ? 1 : 0, kind, input.setBy ?? null, input.setByName ?? null, capturedAt, now, now, input.area ?? null, input.province ?? null]
    );

    created = {
      id,
      clientId: input.clientId,
      seq,
      label: input.label ?? null,
      lat: input.lat,
      lng: input.lng,
      isCurrent,
      kind,
      source: 'field_set',
      setBy: input.setBy ?? null,
      setByName: input.setByName ?? null,
      capturedAt,
      area: input.area ?? null,
      province: input.province ?? null,
    };
  });

  // created is always assigned inside the transaction above (withTransactionAsync
  // awaits its callback), but the compiler can't prove that across the closure.
  if (!created) throw new Error('addStoreLocation: insert did not complete');
  return created;
}

/**
 * Re-selects an already-saved location as the current one — e.g. the store
 * moved back to a previous spot. Demote-then-promote in one transaction.
 */
export async function setCurrentStoreLocation(clientId: string, locationId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE client_locations SET is_current = 0, local_updated_at = ? WHERE client_id = ? AND is_current = 1",
      [now, clientId]
    );
    await db.runAsync(
      "UPDATE client_locations SET is_current = 1, local_updated_at = ?, sync_status = 'pending' WHERE id = ? AND client_id = ?",
      [now, locationId, clientId]
    );
  });
}
