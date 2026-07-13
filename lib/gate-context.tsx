import { createContext, useContext, useState, type ReactNode } from 'react';

interface GateStore {
  unlocked: boolean;
  unlock: () => void;
  relock: () => void;
}

const GateContext = createContext<GateStore | null>(null);

/**
 * Session-scoped unlock for sensitive client info (ADR-007 "Client info
 * protection" — fingerprint/passcode). Demo gate: any 4-digit code or the
 * fingerprint tap unlocks for the rest of the session, matching the
 * wireframe's aUnlockSuccess() behavior. Real biometric/passcode storage is
 * out of scope until backend auth lands.
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
