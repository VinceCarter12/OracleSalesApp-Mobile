import { supabase } from '../supabase';
import { withTimeout } from '../with-timeout';
import { classifyAccountStatus, toActiveProfileSnapshot, type AccountStatus, type ActiveProfileSnapshot } from './account-status-classify';

export type { AccountStatus } from './account-status-classify';
export type { ActiveProfileSnapshot } from './account-status-classify';

// Batch 5 Slice 2 (ADR-051): default budget for the two non-blocking checks
// (foreground/resume, post-cold-start-rehydration). Sensitive-write call
// sites (lib/meeting-service.ts, lib/client-service.ts) pass a much shorter
// budget so a suspension check never meaningfully delays an offline field
// write.
const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Thrown by sensitive-write call sites when `verifyAccountActive()` confirms
 * suspension mid-write. The calling UI MUST catch this and route to
 * `AccountSuspendedScreen` (via `session.markSuspended()`) — never swallow
 * it silently.
 */
export class AccountSuspendedError extends Error {
  constructor() {
    super('This account has been deactivated by an administrator.');
    this.name = 'AccountSuspendedError';
  }
}

// Single-flight dedupe: a foreground check and a sensitive write can both
// call verifyAccountActive() for the same profileId within milliseconds of
// each other — this collapses them into one in-flight request instead of
// firing a duplicate. Simple in-memory Map, no external library.
const inFlightChecks = new Map<string, Promise<AccountStatus>>();

/**
 * Confirms whether `profileId`'s account is still active, straight from
 * Supabase (`profiles.is_active`, same table/shape as the login-time check
 * in `app/(auth)/login.tsx`). Fails OPEN to `'unverified'` on any timeout,
 * network error, or unexpected response — only an explicit
 * `is_active === false` on a successful response resolves `'suspended'`.
 */
export function verifyAccountActive(profileId: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<AccountStatus> {
  const existing = inFlightChecks.get(profileId);
  if (existing) return existing;

  const check = runCheck(profileId, timeoutMs).finally(() => {
    inFlightChecks.delete(profileId);
  });
  inFlightChecks.set(profileId, check);
  return check;
}

async function runCheck(profileId: string, timeoutMs: number): Promise<AccountStatus> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.from('profiles').select('is_active').eq('id', profileId).maybeSingle()),
      timeoutMs,
      'verifyAccountActive'
    );
    return classifyAccountStatus({ data, error });
  } catch {
    // Timed-out/thrown call (network error, hung request) — fail open.
    return 'unverified';
  }
}

export interface AccountStatusCheck {
  status: AccountStatus;
  /** Populated only when `status === 'active'` — lets a confirmed-active caller (e.g. `use-suspension-watch.ts`'s cold-start-rehydration refresh) get fresh role/team/name without firing a second near-duplicate `profiles` query. */
  profile: ActiveProfileSnapshot | null;
}

// Separate single-flight dedupe map from `verifyAccountActive`'s — different
// return shape, and the two variants are never both in flight for the same
// profileId at the same instant (this one is only called from Slice 3's
// 'active' rehydration-refresh path, not the sensitive-write call sites).
const inFlightChecksWithProfile = new Map<string, Promise<AccountStatusCheck>>();

/**
 * Same suspension check as `verifyAccountActive()`, but selects the wider
 * profile row so a confirmed `'active'` result can also refresh the
 * SecureStore cold-start snapshot (`session-snapshot.ts`'s `writeSnapshot()`)
 * in one query instead of two (ADR-051 Slice 3 refinement).
 */
export function verifyAccountActiveWithProfile(
  profileId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<AccountStatusCheck> {
  const existing = inFlightChecksWithProfile.get(profileId);
  if (existing) return existing;

  const check = runCheckWithProfile(profileId, timeoutMs).finally(() => {
    inFlightChecksWithProfile.delete(profileId);
  });
  inFlightChecksWithProfile.set(profileId, check);
  return check;
}

async function runCheckWithProfile(profileId: string, timeoutMs: number): Promise<AccountStatusCheck> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase.from('profiles').select('user_id, role, is_active, team_id, full_name').eq('id', profileId).maybeSingle()
      ),
      timeoutMs,
      'verifyAccountActiveWithProfile'
    );
    const status = classifyAccountStatus({ data, error });
    const profile = status === 'active' && data ? toActiveProfileSnapshot(data) : null;
    return { status, profile };
  } catch {
    // Timed-out/thrown call (network error, hung request) — fail open, same as runCheck().
    return { status: 'unverified', profile: null };
  }
}
