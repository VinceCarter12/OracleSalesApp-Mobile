import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_MANAGER_SCOPE, type ManagerScope } from './manager-scope';
import { useSession } from './session-store';

interface ManagerScopeStore {
  scope: ManagerScope;
  setScope: (scope: ManagerScope) => void;
}

const ManagerScopeContext = createContext<ManagerScopeStore | null>(null);

/**
 * Batch 6 PR C (ADR-052 §G): session-only manager record scope
 * ('mine'|'team'|'combined'). Deliberately a plain in-memory `useState`, NOT
 * backed by SecureStore/SQLite — Sprint.md's confirmed decision is that this
 * resets on cold start, logout, account switch, or role change, and must
 * never survive any of those.
 *
 * Mount point: `app/(manager)/_layout.tsx`, inside the `(manager)` route
 * group. That group is gated by `app/_layout.tsx`'s
 * `Stack.Protected guard={isSignedIn && isManager}` — the ONLY way to reach
 * this app is `app/(auth)/login.tsx`'s `signIn()` call (there is no in-place
 * "switch account" shortcut, confirmed by searching every `signIn(`/
 * `signOut()` call site under `app/`). `signOut()` sets `isSignedIn=false`
 * synchronously, flipping the guard false on the next render, which unmounts
 * the whole `(manager)` Stack.Screen (and this provider with it) before a
 * subsequent `signIn()` — even as a different manager — remounts it fresh.
 * That natural unmount/remount is the primary reset mechanism.
 *
 * The `useEffect` below is a deliberate second, independent reset path (not
 * a duplicate of the same behavior) — it re-arms to `DEFAULT_MANAGER_SCOPE`
 * whenever `profileId` changes for any reason while this provider happens to
 * still be mounted, so the guarantee holds even if a future navigator change
 * ever keeps `(manager)` alive across a sign-out/sign-in pair.
 */
export function ManagerScopeProvider({ children }: { children: ReactNode }) {
  const { profileId } = useSession();
  const [scope, setScope] = useState<ManagerScope>(DEFAULT_MANAGER_SCOPE);

  useEffect(() => {
    setScope(DEFAULT_MANAGER_SCOPE);
  }, [profileId]);

  const value = useMemo(() => ({ scope, setScope }), [scope]);

  return <ManagerScopeContext.Provider value={value}>{children}</ManagerScopeContext.Provider>;
}

export function useManagerScope(): ManagerScopeStore {
  const ctx = useContext(ManagerScopeContext);
  if (!ctx) throw new Error('useManagerScope must be used within a ManagerScopeProvider');
  return ctx;
}
