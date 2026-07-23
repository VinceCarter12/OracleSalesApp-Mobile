import { COLORS } from './theme';
import type { TeamAgent, TeamClient, TeamMeeting } from '../types';

/**
 * Manager team mock data — mirrors Wireframe.html's mock arrays 1:1 (agents,
 * clients, meetings) so the app and the spec of record (ADR-010) never
 * disagree. No manager aggregate tables exist in Supabase yet (Sprint.md) —
 * swap for real queries once that's scoped. F-205 retired the
 * approvals/tagAlongRequests mock arrays entirely — Approvals no longer
 * exists, and tag-along accept/decline now reads real data
 * (`lib/tag-along-invitee-service.ts`, B-053).
 *
 * 2026-07-23: the team-level Sales-vs-RSR "track" concept (ADR-017,
 * 2026-07-14) is retired — teams are no longer segregated; every team now
 * mixes a manager + sales_specialist + rsr agent together. This file is down
 * to a single generic mock dataset (formerly the "sales" track's), kept only
 * until real manager aggregate/team tables exist. RSR remains a real,
 * distinct *agent* role (ADR-013) — unaffected by this retirement.
 */

export interface ManagerProfile {
  id: string;
  firstName: string;
  fullName: string;
  title: string;
  team: string;
}

const MANAGER_PROFILE: ManagerProfile = {
  id: 'mgr-1',
  firstName: 'Erika',
  fullName: 'Erika Bautista',
  title: 'Manager',
  team: 'North Luzon Team',
};

export function managerProfile(): ManagerProfile {
  return MANAGER_PROFILE;
}

export const AGENT_COLORS: Record<string, { background: string; color: string }> = {
  a1: { background: COLORS.greenTint, color: COLORS.ledgeGreen },
  a2: { background: COLORS.blueSoft, color: COLORS.blue },
  a3: { background: COLORS.amberSoft, color: COLORS.orange },
  a4: { background: COLORS.purpleSoft, color: COLORS.purple },
  'mgr-1': { background: COLORS.purpleSoft, color: COLORS.purple },
};

const SALES_AGENTS: TeamAgent[] = [
  { id: 'a1', name: 'Miguel Santos', initials: 'MS', meetingsThisMonth: 14, activeClients: 22, successRate: 72 },
  { id: 'a2', name: 'Ana Reyes', initials: 'AR', meetingsThisMonth: 19, activeClients: 28, successRate: 81 },
  { id: 'a3', name: 'Paolo Cruz', initials: 'PC', meetingsThisMonth: 11, activeClients: 20, successRate: 58 },
  { id: 'a4', name: 'Jenny Lim', initials: 'JL', meetingsThisMonth: 17, activeClients: 26, successRate: 76 },
];

const SALES_CLIENTS: TeamClient[] = [
  {
    id: 'c1', name: 'Oracle Petroleum (Bataan)', agentId: 'a1', status: 'prospect', channel: 'Distributor',
    checklist: { name: true, contact: true, number: true, address: false, channel: false }, deadline: 'Aug 2 (26 days)',
  },
  {
    id: 'c2', name: 'MetroTrans Logistics', agentId: 'a3', status: 'prospect', channel: '—',
    checklist: { name: true, contact: false, number: false, address: false, channel: false }, deadline: '5 days left', deadlineWarn: true,
  },
  {
    id: 'c3', name: 'KVR Hardware', agentId: 'a1', status: 'prospect', channel: '—',
    checklist: { name: true, contact: false, number: false, address: false, channel: false }, deadline: '2 days left', deadlineWarn: true,
  },
  {
    id: 'c4', name: 'RMC Fuels Inc.', agentId: 'a2', status: 'new', channel: 'Dealer',
    checklist: { name: true, contact: true, number: true, address: true, channel: true }, deadline: '—',
  },
  {
    id: 'c5', name: 'SolidLube Trading', agentId: 'a2', status: 'existing', channel: 'End-User',
    checklist: { name: true, contact: true, number: true, address: true, channel: true }, deadline: '—',
  },
  {
    id: 'c6', name: 'PetroGo (Pampanga)', agentId: 'a4', status: 'existing', channel: 'Distributor',
    checklist: { name: true, contact: true, number: true, address: true, channel: true }, deadline: '—',
  },
  {
    id: 'c7', name: 'BenX Motors', agentId: 'a3', status: 'inactive', channel: '—',
    checklist: { name: true, contact: true, number: true, address: true, channel: true }, deadline: '—',
  },
  {
    id: 'c8', name: 'Greenline Traders', agentId: 'a4', status: 'new', channel: 'Private Label',
    checklist: { name: true, contact: true, number: true, address: true, channel: true }, deadline: '—',
  },
];

// Newest-first, matching Wireframe.html's Jul-10 reorder.
const SALES_MEETINGS: TeamMeeting[] = [
  {
    // ADR-015 existing-client fast path — photo-only start/end, no outcome/remarks.
    id: 'm109', clientId: 'c5', agentId: 'a2', date: 'Jul 10', time: '1:00 PM', location: 'Client Office',
    contact: 'R. Santiago', position: 'CEO', custType: 'Existing', agenda: ['Product / company presentation'],
    remarks: '', outcome: null, meetingMode: 'in_person', gps: '14.6091° N, 121.0223° E', tagAlong: false,
    synced: true, fastPath: true, startTime: '1:00 PM', endTime: '1:30 PM',
  },
  {
    id: 'm108', clientId: 'c1', agentId: 'a1', date: 'Jul 7', time: '3:10 PM', location: 'Client Office',
    contact: 'J. Cruz', position: 'Purchasing', custType: 'Prospect', agenda: ['Product / company presentation', 'Relationship building'],
    remarks: "Sinamahan ni Ma'am Erika, in-introduce sa bagong pricing.", outcome: 'follow', meetingMode: 'in_person',
    gps: '14.5547° N, 120.9842° E', tagAlong: true, tagAlongManagerName: 'Erika Bautista', tagAlongStatus: 'pending', synced: true,
  },
  {
    id: 'm101', clientId: 'c1', agentId: 'a1', date: 'Jul 6', time: '9:41 AM', location: 'Client Office',
    contact: 'J. Cruz', position: 'Purchasing', custType: 'Prospect', agenda: ['New business opportunity', 'Product / company presentation'],
    remarks: 'Interested sa bulk order, susundan sa susunod na linggo.', outcome: 'success', meetingMode: 'in_person',
    gps: '14.5547° N, 120.9842° E', tagAlong: false, synced: false,
  },
  {
    id: 'm102', clientId: 'c4', agentId: 'a2', date: 'Jul 4', time: '2:15 PM', location: 'Starbucks Alabang',
    contact: 'M. Villar', position: 'Owner', custType: 'New', agenda: ['Price negotiation / quotation'],
    remarks: 'Hihintayin ang budget approval sa susunod na buwan.', outcome: 'follow', meetingMode: 'in_person',
    gps: '14.4187° N, 121.0450° E', tagAlong: true, synced: true,
  },
  {
    id: 'm103', clientId: 'c5', agentId: 'a2', date: 'Jul 3', time: '10:02 AM', location: 'Client Office',
    contact: 'R. Santiago', position: 'CEO', custType: 'Existing', agenda: ['Relationship building', 'Closed deal'],
    remarks: 'Naka-close na ang renewal contract.', outcome: 'success', meetingMode: 'in_person',
    gps: '14.6091° N, 121.0223° E', tagAlong: false, synced: true,
  },
  {
    id: 'm104', clientId: 'c7', agentId: 'a3', date: 'Jun 30', time: '4:40 PM', location: 'Client Office',
    contact: '—', position: '—', custType: 'Existing', agenda: ['Collection'],
    remarks: 'Hindi na po sumasagot, ilang beses ng huli sa bayad.', outcome: 'lost', meetingMode: 'in_person',
    gps: '14.5378° N, 121.0014° E', tagAlong: false, synced: true,
  },
  {
    id: 'm105', clientId: 'c6', agentId: 'a4', date: 'Jun 28', time: '11:20 AM', location: 'Client Office',
    contact: 'P. Domingo', position: 'Purchasing', custType: 'Existing', agenda: ['Technical support'],
    remarks: 'Kailangan ng follow-up demo sa bagong product line.', outcome: 'nodec', meetingMode: 'in_person',
    gps: '15.0794° N, 120.6200° E', tagAlong: false, synced: true,
  },
  {
    // ADR-012 online meeting demo — GPS = agent's own location, not the client's.
    id: 'm106', clientId: 'c2', agentId: 'a3', date: 'Jun 27', time: '1:05 PM', location: 'Online (video call)',
    contact: '—', position: '—', custType: 'Prospect', agenda: ['New business opportunity'],
    remarks: 'Unang pagkikita via video call, gagawa pa ng follow up.', outcome: 'nodec', meetingMode: 'online',
    gps: '14.6760° N, 121.0437° E', tagAlong: false, synced: true,
  },
  {
    id: 'm107', clientId: 'c8', agentId: 'a4', date: 'Jun 25', time: '3:30 PM', location: 'Client Office',
    contact: 'L. Tan', position: 'Owner', custType: 'New', agenda: ['Closed deal'],
    remarks: 'Sign na ang kontrata, unang order darating sa Aug.', outcome: 'success', meetingMode: 'in_person',
    gps: '14.5891° N, 120.9803° E', tagAlong: true, tagAlongManagerName: 'Erika Bautista', tagAlongStatus: 'approved', synced: true,
  },
];

export function getManagerAgents(): TeamAgent[] {
  return SALES_AGENTS;
}
export function getManagerClients(): TeamClient[] {
  return SALES_CLIENTS;
}
export function getManagerMeetings(): TeamMeeting[] {
  return SALES_MEETINGS;
}

/**
 * Progress % is driven solely by Record Meeting → Agenda: 100% once a
 * meeting's agenda included "Product / company presentation," 0% otherwise.
 * Info completion has ZERO weight — separate data-quality gate (1-month
 * rule), not a progress contributor (B-001, corrected 2026-07-11 per direct
 * client instruction — an earlier same-day blended 80% info + 20%
 * presentation formula was itself wrong and was rejected; do not
 * reintroduce it). Mirrors computeProgress() in Wireframe.html so
 * manager/agent views never disagree.
 */
export interface TeamClientProgressBreakdown {
  presented: boolean;
  total: number;
}

export function getTeamClientProgressBreakdown(
  client: TeamClient,
  meetings: TeamMeeting[] = SALES_MEETINGS
): TeamClientProgressBreakdown {
  const presented = meetings.some(
    (m) => m.clientId === client.id && m.agenda.includes('Product / company presentation')
  );
  return { presented, total: presented ? 100 : 0 };
}

export function computeTeamClientProgress(client: TeamClient, meetings: TeamMeeting[] = SALES_MEETINGS): number {
  return getTeamClientProgressBreakdown(client, meetings).total;
}

export function meetingsForClient(clientId: string): TeamMeeting[] {
  return SALES_MEETINGS.filter((m) => m.clientId === clientId);
}
export function meetingsForAgent(agentId: string): TeamMeeting[] {
  return SALES_MEETINGS.filter((m) => m.agentId === agentId);
}
export function clientsForAgent(agentId: string): TeamClient[] {
  return SALES_CLIENTS.filter((c) => c.agentId === agentId);
}
