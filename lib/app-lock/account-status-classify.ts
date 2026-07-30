import type { UserRole } from '../../types';

export type AccountStatus = 'active' | 'suspended' | 'unverified';

/** Shape returned by `supabase.from('profiles').select('is_active').eq('id', profileId).maybeSingle()` — kept minimal (not the full PostgrestError/Database types) so this stays importable without pulling in `lib/supabase.ts`. */
export interface ProfileActiveQueryResult {
  data: { is_active: boolean } | null;
  error: { message: string } | null;
}

/** Row shape for `.select('user_id, role, is_active, team_id, full_name')` — the wider query `verifyAccountActiveWithProfile` (account-status.ts) uses so a confirmed-`'active'` result can refresh the cold-start snapshot without a second near-duplicate profiles query. */
export interface ActiveProfileRow {
  user_id: string;
  role: string;
  team_id: string | null;
  full_name: string | null;
}

/** Fields `lib/app-lock/session-snapshot.ts`'s `writeSnapshot()` needs — same shape as `WritableSessionSnapshot` minus `profileId` (the caller already has it). */
export interface ActiveProfileSnapshot {
  userId: string;
  role: UserRole;
  teamId: string | null;
  fullName: string;
}

/**
 * Pure mapping from a fresh `profiles` row to the fields `writeSnapshot()`
 * needs. Same single-cast convention as `app/(auth)/login.tsx`'s
 * `profile.role as UserRole` (the live `profiles.role` check constraint is
 * the actual runtime guarantee here — see ADR-051 Q7) rather than
 * re-validating against a duplicated role-literal tuple.
 */
export function toActiveProfileSnapshot(row: ActiveProfileRow): ActiveProfileSnapshot {
  return {
    userId: row.user_id,
    role: row.role as UserRole,
    teamId: row.team_id,
    fullName: row.full_name ?? '',
  };
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
