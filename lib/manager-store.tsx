import { createContext, useContext, useState, type ReactNode } from 'react';
import { getManagerClients, getManagerMeetings } from './manager-data';
import type { TeamClient, TeamMeeting } from '../types';

interface ManagerStore {
  clients: TeamClient[];
  meetings: TeamMeeting[];
}

const ManagerStoreContext = createContext<ManagerStore | null>(null);

/**
 * In-memory team data store for the Manager frontend (mirrors
 * Wireframe.html's mutable mock arrays). Backed by manager-data.ts seed
 * data — no Supabase manager aggregate tables exist yet (Sprint.md), so
 * nothing here persists past a session reload.
 *
 * F-205: Approvals + tag-along accept/decline are retired from this store —
 * Approvals no longer exists as a concept (real client/meeting flows moved
 * to `app/(manager)/clients/*`), and tag-along accept/decline is handled by
 * real data (`lib/tag-along-invitee-service.ts`, B-053) via
 * `app/(manager)/tag-along.tsx`, not this mock store. `clients`/`meetings`
 * are both kept for future consumers only — as of the quality-gate fix
 * (2026-07-22), `app/(manager)/more/reports.tsx` no longer reads `meetings`
 * from here (it was mock fixture data silently bypassing the Timeframe
 * filter); it now reads real data from `useTeamOverview()` instead.
 */
export function ManagerStoreProvider({ children }: { children: ReactNode }) {
  // Lazy initializers — the track was already selected at sign-in, before this
  // provider mounts (session-store.tsx), so these snapshot the right dataset.
  const [clients] = useState<TeamClient[]>(() => getManagerClients());
  const [meetings] = useState<TeamMeeting[]>(() => getManagerMeetings());

  return (
    <ManagerStoreContext.Provider value={{ clients, meetings }}>
      {children}
    </ManagerStoreContext.Provider>
  );
}

export function useManagerStore(): ManagerStore {
  const ctx = useContext(ManagerStoreContext);
  if (!ctx) throw new Error('useManagerStore must be used within a ManagerStoreProvider');
  return ctx;
}
