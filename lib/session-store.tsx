import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { setManagerTrack } from './manager-data';
import type { UserRole } from '../types';

type SessionStore = {
  isSignedIn: boolean;
  role: UserRole | null;
  signIn: (role: UserRole) => void;
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

  const value = useMemo(
    () => ({
      isSignedIn,
      role,
      signIn: (nextRole: UserRole) => {
        // Select the manager mock dataset before any (manager) screen mounts
        // (sales_manager vs rsr_manager share the same UI, ADR-014).
        setManagerTrack(nextRole);
        setRole(nextRole);
        setIsSignedIn(true);
      },
      signOut: () => {
        setIsSignedIn(false);
        setRole(null);
      },
    }),
    [isSignedIn, role]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionStore {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
