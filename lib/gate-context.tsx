import { createContext, useContext, useState, type ReactNode } from 'react';

interface GateStore {
  unlocked: boolean;
  unlock: () => void;
  relock: () => void;
}

const GateContext = createContext<GateStore | null>(null);

/**
 * Session-scoped unlock for sensitive client info (ADR-007 "Client info
 * protection" — passcode). A verified 4-digit passcode (B-064, see
 * `lib/passcode.ts`) unlocks for the rest of the session, matching the
 * wireframe's aUnlockSuccess() behavior. The fingerprint icon was a
 * direct-unlock stub with no real biometric check and was removed (B-064
 * addendum) as a security fix; real biometric hardware auth remains a
 * separate future task.
 */
export function GateProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <GateContext.Provider
      value={{
        unlocked,
        unlock: () => setUnlocked(true),
        relock: () => setUnlocked(false),
      }}
    >
      {children}
    </GateContext.Provider>
  );
}

export function useGate(): GateStore {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error('useGate must be used within a GateProvider');
  return ctx;
}
