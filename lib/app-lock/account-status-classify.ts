export type AccountStatus = 'active' | 'suspended' | 'unverified';

/** Shape returned by `supabase.from('profiles').select('is_active').eq('id', profileId).maybeSingle()` — kept minimal (not the full PostgrestError/Database types) so this stays importable without pulling in `lib/supabase.ts`. */
export interface ProfileActiveQueryResult {
  data: { is_active: boolean } | null;
  error: { message: string } | null;
}

/**
 * Pure classification of a `profiles.is_active` query result into an
 * `AccountStatus`. Split out from `account-status.ts` (which does the actual
 * Supabase/timeout I/O) so this can be unit-tested directly — importing
 * `lib/supabase.ts` transitively pulls in `react-native`, which
 * vitest/rolldown cannot parse (same reason `bootstrap-decision.ts` was
 * split out of `cold-start-bootstrap.ts` in Slice 1).
 *
 * Fail-CLOSED-to-'unverified', never fail-open-to-'suspended' (ADR-051): any
 * query error or missing row is 'unverified', not 'suspended'. Only an
 * explicit `is_active === false` on a successful response is 'suspended'. A
 * 401/403 auth error also lands here as 'unverified' — that's token expiry,
 * which is the caller's job to route to signed_out, not this function's.
 */
export function classifyAccountStatus(result: ProfileActiveQueryResult): AccountStatus {
  if (result.error || !result.data) return 'unverified';
  return result.data.is_active === false ? 'suspended' : 'active';
}
