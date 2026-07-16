import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import {
  getManagerApprovals,
  getManagerClients,
  getManagerMeetings,
  getManagerTagAlongRequests,
  managerAsAgent,
} from './manager-data';
import type { TagAlongRequest, TeamApproval, TeamClient, TeamMeeting } from '../types';

export class DuplicateTeamClientNameError extends Error {
  constructor(name: string) {
    super(`A client named "${name}" already exists on the team.`);
    this.name = 'DuplicateTeamClientNameError';
  }
}

interface ManagerStore {
  clients: TeamClient[];
  meetings: TeamMeeting[];
  approvals: TeamApproval[];
  tagAlongRequests: TagAlongRequest[];
  acceptTagAlong: (id: string) => void;
  declineTagAlong: (id: string) => void;
  decideApproval: (id: string, approve: boolean) => void;
  requestReassign: (clientId: string, toAgentId: string) => void;
  /** Manager-created clients apply directly — no SM approval needed, since the manager IS the approver. */
  addClient: (companyName: string, channel: string) => TeamClient;
}

const ManagerStoreContext = createContext<ManagerStore | null>(null);

/**
 * In-memory team data store for the Manager frontend (mirrors Wireframe.html's
 * mutable mock arrays: accept/decline tag-along, approve/reject edits &
 * reassignments). Backed by manager-data.ts seed data — no Supabase manager
 * aggregate tables exist yet (Sprint.md), so nothing here persists past a
 * session reload.
 */
export function ManagerStoreProvider({ children }: { children: ReactNode }) {
  // Lazy initializers — the track was already selected at sign-in, before this
  // provider mounts (session-store.tsx), so these snapshot the right dataset.
  const [clients, setClients] = useState<TeamClient[]>(() => getManagerClients());
  const [meetings, setMeetings] = useState<TeamMeeting[]>(() => getManagerMeetings());
  const [approvals, setApprovals] = useState<TeamApproval[]>(() => getManagerApprovals());
  const [tagAlongRequests, setTagAlongRequests] = useState<TagAlongRequest[]>(() => getManagerTagAlongRequests());

  const acceptTagAlong = useCallback((id: string) => {
    setTagAlongRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const declineTagAlong = useCallback((id: string) => {
    setTagAlongRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const decideApproval = useCallback((id: string, approve: boolean) => {
    setApprovals((prev) => {
      const target = prev.find((a) => a.id === id);
      if (!target) return prev;
      if (approve && target.type === 'reassign' && target.toAgentId) {
        setClients((clientsPrev) =>
          clientsPrev.map((c) => (c.id === target.clientId ? { ...c, agentId: target.toAgentId! } : c))
        );
      }
      if (target.type === 'tagalong' && target.meetingId) {
        setMeetings((meetingsPrev) =>
          meetingsPrev.map((m) =>
            m.id === target.meetingId ? { ...m, tagAlongStatus: approve ? 'approved' : 'rejected' } : m
          )
        );
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const requestReassign = useCallback((clientId: string, toAgentId: string) => {
    setApprovals((prev) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return prev;
      return [
        ...prev,
        {
          id: `ap-${Date.now()}`,
          type: 'reassign',
          clientId,
          agentId: client.agentId,
          toAgentId,
          requested: 'Just now',
        },
      ];
    });
  }, [clients]);

  const addClient = useCallback(
    (companyName: string, channel: string): TeamClient => {
      const trimmed = companyName.trim();
      const duplicate = clients.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (duplicate) throw new DuplicateTeamClientNameError(trimmed);

      const newClient: TeamClient = {
        id: `c-mgr-${Date.now()}`,
        name: trimmed,
        agentId: managerAsAgent().id,
        status: 'prospect',
        channel,
        checklist: { name: true, contact: false, number: false, address: false, channel: false },
        deadline: '1 month to complete info',
      };
      setClients((prev) => [newClient, ...prev]);
      return newClient;
    },
    [clients]
  );

  return (
    <ManagerStoreContext.Provider
      value={{ clients, meetings, approvals, tagAlongRequests, acceptTagAlong, declineTagAlong, decideApproval, requestReassign, addClient }}
    >
      {children}
    </ManagerStoreContext.Provider>
  );
}

export function useManagerStore(): ManagerStore {
  const ctx = useContext(ManagerStoreContext);
  if (!ctx) throw new Error('useManagerStore must be used within a ManagerStoreProvider');
  return ctx;
}
