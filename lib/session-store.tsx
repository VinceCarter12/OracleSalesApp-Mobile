import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { UserRole } from '../types';
import type { SessionSnapshot } from './app-lock/session-snapshot';

/**
 * Batch 5 Slice 1 (ADR-051): cold-start lifecycle status.
 * - 'bootstrapping': app-root bootstrap (app/_layout.tsx) is still deciding
 *   between a rehydrated session, a signed-out state, or nothing to restore —
 *   RootNavigator must not evaluate any Stack.Protected guard yet, to avoid a
 *   one-frame flash of the login screen.
 * - 'signed_in' / 'signed_out': terminal states once bootstrap resolves, or
 *   after a normal signIn()/signOut() call post-bootstrap.
 */
export type SessionStatus = 'bootstrapping' | 'signed_in' | 'signed_out';

type SessionStore = {
  status: SessionStatus;
  /**
   * Batch 5 Slice 2 (ADR-051) PLACEHOLDER — this flag is the smallest
   * reasonable stand-in for "show AccountSuspendedScreen instead of normal
   * navigation" until Slice 3's full `AppLockProvider`/`LockGate` state
   * machine replaces it. Do not build additional lock states around this;
   * it exists only to route the three Slice-2 suspension-check trigger
   * points to a full-screen suspended UI.
   */
  suspended: boolean;
  isSignedIn: boolean;
  role: UserRole | null;
  /** The signed-in user's `profiles.team_id` — needed by the Manager dashboard to query real team-wide data (2026-07-16). No longer feeds a team-level "track" (retired 2026-07-23, ADR-017 addendum). */
  teamId: string | null;
  /**
   * The signed-in user's `profiles.id` — NOT the same value as
   * `session.user.id` (the Supabase Auth uid, `profiles.user_id`). Every
   * `clients.assigned_agent_id`/`meetings.agent_id` FK references
   * `profiles.id`, so this is the value that must be used for record
   * ownership everywhere — `session.user.id` is only for `auth.*` calls and
   * storage-path conventions. Confirmed via the live web migration
   * (`profiles.id UUID DEFAULT uuid_generate_v4()`, independent of `user_id`).
   */
  profileId: string | null;
  /** The signed-in user's `profiles.full_name` — real display name, not a hardcoded placeholder (B-018). */
  fullName: string | null;
  signIn: (role: UserRole, teamId: string | null, profileId: string, fullName: string | null) => void;
  signOut: () => void;
  /**
   * Batch 5 Slice 1: populates role/teamId/profileId/fullName/isSignedIn
   * from a SecureStore-validated snapshot on cold start, without going
   * through the normal signIn() login flow (no fresh Supabase call). Also
   * sets `status` to 'signed_in'.
   */
  rehydrate: (snapshot: SessionSnapshot) => void;
  /**
   * Batch 5 Slice 2 PLACEHOLDER: sets `suspended` true so `RootNavigator`
   * (app/_layout.tsx) renders `AccountSuspendedScreen` instead of the normal
   * Stack.Protected tree. Callers: the foreground/resume AppState listener,
   * the post-rehydration cold-start check, and the sensitive-write call
   * sites (via their `AccountSuspendedError` catch).
   */
  markSuspended: () => void;
};

const SessionContext = createContext<SessionStore | null>(null);

/**
 * Post-auth role/navigation state. The actual credential check now happens
 * against real Supabase auth (`lib/useAuth.ts`, T-002/T-003) in
 * `app/(auth)/login.tsx`; this store only holds the resulting `profiles.role`
 * so `RootNavigator` (`app/_layout.tsx`) knows whether to show `(tabs)` or
 * `(manager)`. `signIn` takes the role explicitly — it is never guessed here.
 *
 * Batch 5 Slice 1 (ADR-051): `status` starts at 'bootstrapping' so
 * RootNavigator can withhold Stack.Protected guard evaluation until cold-start
 * rehydration resolves. `useSession()` is intentionally KEPT (not renamed) —
 * ADR-051 explicitly rejected folding this into a new unified session module.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('bootstrapping');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);

  const value = useMemo(
    () => ({
      status,
      suspended,
      isSignedIn,
      role,
      teamId,
      profileId,
      fullName,
      signIn: (nextRole: UserRole, nextTeamId: string | null, nextProfileId: string, nextFullName: string | null) => {
        setRole(nextRole);
        setTeamId(nextTeamId);
        setProfileId(nextProfileId);
        setFullName(nextFullName);
        setIsSignedIn(true);
        setSuspended(false);
        setStatus('signed_in');
      },
      signOut: () => {
        setIsSignedIn(false);
        setRole(null);
        setTeamId(null);
        setProfileId(null);
        setFullName(null);
        setSuspended(false);
        setStatus('signed_out');
      },
      markSuspended: () => {
        setSuspended(true);
      },
      rehydrate: (snapshot: SessionSnapshot) => {
        setRole(snapshot.role);
        setTeamId(snapshot.teamId);
        setProfileId(snapshot.profileId);
        setFullName(snapshot.fullName);
        setIsSignedIn(true);
        setSuspended(false);
        setStatus('signed_in');
      },
    }),
    [status, suspended, isSignedIn, role, teamId, profileId, fullName]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionStore {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
