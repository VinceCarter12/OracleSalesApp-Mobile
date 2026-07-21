import { getDb } from './db';
import { supabase } from './supabase';
import { withTimeout } from './with-timeout';
import { normalizeCompanyName } from './company-name';

// T-005: duplicate-name checking, split out of client-service.ts to stay
// under the 300-line file limit (ADR-026 P2 item 8 pushed client-service.ts
// over it once getClientById() was added). Pure lookup logic — no writes.

const LIVE_CHECK_TIMEOUT_MS = 8000;

export type DuplicateCheckResult = 'duplicate' | 'available' | 'unknown';

export class DuplicateCompanyNameError extends Error {
  constructor(companyName: string) {
    super(`A client named "${companyName}" already exists.`);
    this.name = 'DuplicateCompanyNameError';
  }
}

/**
 * Local-only half of the duplicate check: (a) local `clients` rows in ANY
 * sync state — including this device's own not-yet-synced writes, which the
 * pre-T-005 check never looked at, (b) the read-only company-name snapshot
 * cache. Both are plain SQLite reads (sub-millisecond) — safe to await on
 * every keystroke's debounce tick without the UI feeling laggy. Split out
 * from the live-check tail (B-020) so the Create Client button can activate
 * the instant these pass, instead of blocking on a Supabase round-trip.
 */
export async function checkLocalDuplicate(
  companyName: string,
  city: string | null,
  excludeClientId?: string
): Promise<'duplicate' | 'clear'> {
  const normalized = normalizeCompanyName(companyName);
  if (!normalized) return 'clear';

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
  return snapshotMatch ? 'duplicate' : 'clear';
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

/**
 * Full check used as the final safety gate inside `createClient()` right
 * before writing: local + snapshot (see `checkLocalDuplicate`), THEN a live
 * Supabase check if those pass. City is collected at Create Client itself
 * (2026-07-15 revision — an agent always knows the city they're in), so
 * this is a hard (name, city) check, not a deferred soft warning.
 *
 * NOT used for the Create Client screen's live typing/button-gate anymore
 * (B-020) — the live tail can take up to `LIVE_CHECK_TIMEOUT_MS` (8s), which
 * made the button feel stuck on every keystroke, especially since the live
 * query's target column doesn't exist on Supabase yet (Migration 014 not
 * applied) and always degrades to 'unknown' the slow way. The UI now
 * activates on `checkLocalDuplicate` alone; this full check still runs here
 * as the actual write-time gate, so a live duplicate is still caught before
 * anything is created — it just no longer blocks the button from being
 * tappable.
 */
export async function checkCompanyNameDuplicate(
  companyName: string,
  city: string | null,
  excludeClientId?: string
): Promise<DuplicateCheckResult> {
  const normalized = normalizeCompanyName(companyName);
  if (!normalized) return 'available';

  const local = await checkLocalDuplicate(companyName, city, excludeClientId);
  if (local === 'duplicate') return 'duplicate';

  return liveDuplicateCheck(normalized, city, excludeClientId);
}
