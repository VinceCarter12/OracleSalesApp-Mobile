import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { UserRole } from '../types';

type SessionStore = {
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
};

const SessionContext = createContext<SessionStore | null>(null);

/**
 * Post-auth role/navigation state. The actual credential check now happens
 * against real Supabase auth (`lib/useAuth.ts`, T-002/T-003) in
 * `app/(auth)/login.tsx`; this store only holds the resulting `profiles.role`
 * so `RootNavigator` (`app/_layout.tsx`) knows whether to show `(tabs)` or
 * `(manager)`. `signIn` takes the role explicitly — it is never guessed here.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  const value = useMemo(
    () => ({
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
      },
      signOut: () => {
        setIsSignedIn(false);
        setRole(null);
        setTeamId(null);
        setProfileId(null);
        setFullName(null);
      },
    }),
    [isSignedIn, role, teamId, profileId, fullName]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionStore {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
