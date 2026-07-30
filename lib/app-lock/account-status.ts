import { supabase } from '../supabase';
import { withTimeout } from '../with-timeout';
import { classifyAccountStatus, type AccountStatus } from './account-status-classify';

export type { AccountStatus } from './account-status-classify';

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
