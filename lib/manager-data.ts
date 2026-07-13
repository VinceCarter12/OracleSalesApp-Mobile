import { COLORS } from './theme';
import type { TeamAgent, TeamApproval, TeamClient, TeamMeeting, TagAlongRequest, UserRole } from '../types';

/**
 * Manager team mock data — mirrors Wireframe.html's mock arrays 1:1 (agents,
 * clients, meetings, approvals, tagAlongRequests) so the app and the spec of
 * record (ADR-010) never disagree. No manager aggregate tables exist in
 * Supabase yet (Sprint.md) — swap for real queries once that's scoped.
 *
 * Track-aware (2026-07-11): sales_manager and rsr_manager share every screen
 * (ADR-014; rsr_manager is mobile-based — supersedes the old web-only note).
 * The active track is set once at sign-in via setManagerTrack(); all getters
 * below read the matching dataset, so screens never branch on role themselves.
 */

export type ManagerTrack = 'sales' | 'rsr';

let activeTrack: ManagerTrack = 'sales';

export function setManagerTrack(role: UserRole | null): void {
  activeTrack = role === 'rsr_manager' ? 'rsr' : 'sales';
}

export function getManagerTrack(): ManagerTrack {
  return activeTrack;
}

export interface ManagerProfile {
  firstName: string;
  fullName: string;
  title: string;
  team: string;
}

const MANAGER_PROFILES: Record<ManagerTrack, ManagerProfile> = {
  sales: { firstName: 'Erika', fullName: 'Erika Bautista', title: 'Sales Manager', team: 'North Luzon Team' },
  rsr: { firstName: 'Rommel', fullName: 'Rommel Aquino', title: 'RSR Manager', team: 'RSR Team' },
};

export function managerProfile(): ManagerProfile {
  return MANAGER_PROFILES[activeTrack];
}

export const AGENT_COLORS: Record<string, { background: string; color: string }> = {
  a1: { background: COLORS.greenTint, color: COLORS.ledgeGreen },
  a2: { background: COLORS.blueSoft, color: COLORS.blue },
  a3: { background: COLORS.amberSoft, color: COLORS.orange },
  a4: { background: COLORS.purpleSoft, color: COLORS.purple },
  r1: { background: COLORS.greenTint, color: COLORS.ledgeGreen },
  r2: { background: COLORS.blueSoft, color: COLORS.blue },
  r3: { background: COLORS.amberSoft, color: COLORS.orange },
  r4: { background: COLORS.purpleSoft, color: COLORS.purple },
  r5: { background: COLORS.greenTint, color: COLORS.ledgeGreen },
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

const SALES_APPROVALS: TeamApproval[] = [
  { id: 'ap1', type: 'edit', clientId: 'c1', agentId: 'a1', field: 'Sales Channel', from: 'Distributor', to: 'Dealer', requested: 'Jul 5' },
  { id: 'ap2', type: 'reassign', clientId: 'c3', agentId: 'a1', toAgentId: 'a2', requested: 'Jul 5' },
  { id: 'ap3', type: 'edit', clientId: 'c4', agentId: 'a2', field: 'Customer Type', from: 'New', to: 'Existing', requested: 'Jul 6' },
  { id: 'ap4', type: 'tagalong', clientId: 'c1', agentId: 'a1', meetingId: 'm108', requested: 'Jul 7' },
];

// Sales Rep requests → Manager accepts/declines → Sales Rep alone records the
// meeting → Manager Approves/Rejects (Meeting-2026-07-08, final single-owner model).
const SALES_TAG_ALONG_REQUESTS: TagAlongRequest[] = [
  { id: 'ta1', agentId: 'a3', clientId: 'c6', note: 'Follow-up demo bukas ng umaga, gusto sana ni Paolo na kasama ka.' },
  { id: 'ta2', agentId: 'a4', clientId: 'c8', note: 'Closing meeting sa Greenline — kasama sana kita para sa renewal talks.' },
];

// ─── RSR track dataset (ADR-013/ADR-014) ───────────────────────────────────────
// Same shapes, dealer/motorshop-flavored: RSR agents are field-based and carry
// the 12-visits/day quota (F-012) — reflected in denser meeting volume.

const RSR_AGENTS: TeamAgent[] = [
  { id: 'r1', name: 'Dario Mendoza', initials: 'DM', meetingsThisMonth: 46, activeClients: 31, successRate: 68 },
  { id: 'r2', name: 'Liza Navarro', initials: 'LN', meetingsThisMonth: 52, activeClients: 35, successRate: 77 },
  { id: 'r3', name: 'Cesar Ilagan', initials: 'CI', meetingsThisMonth: 38, activeClients: 27, successRate: 61 },
  { id: 'r4', name: 'Bong Torres', initials: 'BT', meetingsThisMonth: 44, activeClients: 30, successRate: 70 },
  { id: 'r5', name: 'Nina Salazar', initials: 'NS', meetingsThisMonth: 49, activeClients: 33, successRate: 74 },
];

const RSR_CLIENTS: TeamClient[] = [
  {
    id: 'rc1', name: 'RPM Motorshop', agentId: 'r1', status: 'prospect', channel: 'Dealer',
    checklist: { name: true, contact: true, number: true, address: false, channel: false }, deadline: 'Aug 5 (29 days)',
  },
  {
    id: 'rc2', name: 'SpeedParts Trading (Cavite)', agentId: 'r2', status: 'prospect', channel: '—',
    checklist: { name: true, contact: false, number: false, address: false, channel: false }, deadline: '4 days left', deadlineWarn: true,
  },
  {
    id: 'rc3', name: 'MotoHub Alabang', agentId: 'r3', status: 'new', channel: 'Dealer',
    checklist: { name: true, contact: true, number: true, address: true, channel: true }, deadline: '—',
  },
  {
    id: 'rc4', name: 'TurboWorks Garage', agentId: 'r2', status: 'existing', channel: 'End-User',
    checklist: { name: true, contact: true, number: true, address: true, channel: true }, deadline: '—',
  },
  {
    id: 'rc5', name: 'Lakay Auto Supply', agentId: 'r4', status: 'existing', channel: 'Distributor',
    checklist: { name: true, contact: true, number: true, address: true, channel: true }, deadline: '—',
  },
  {
    id: 'rc6', name: 'Ride-On Motors (Laguna)', agentId: 'r5', status: 'new', channel: 'Dealer',
    checklist: { name: true, contact: true, number: true, address: true, channel: true }, deadline: '—',
  },
];

const RSR_MEETINGS: TeamMeeting[] = [
  {
    // ADR-015 fast path — existing dealer, photo-only start/end.
    id: 'rm105', clientId: 'rc4', agentId: 'r2', date: 'Jul 10', time: '9:20 AM', location: 'Client Office',
    contact: 'A. Buenaventura', position: 'Owner', custType: 'Existing', agenda: ['Relationship building'],
    remarks: '', outcome: null, meetingMode: 'in_person', gps: '14.2456° N, 121.1245° E', tagAlong: false,
    synced: true, fastPath: true, startTime: '9:20 AM', endTime: '9:45 AM',
  },
  {
    id: 'rm104', clientId: 'rc1', agentId: 'r1', date: 'Jul 9', time: '2:40 PM', location: 'Client Office',
    contact: 'E. Ramos', position: 'Owner', custType: 'Prospect', agenda: ['Product / company presentation'],
    remarks: 'Interesado sa lubricants line, hiningan ng price list.', outcome: 'follow', meetingMode: 'in_person',
    gps: '14.4098° N, 120.9821° E', tagAlong: true, tagAlongManagerName: 'Rommel Aquino', tagAlongStatus: 'pending', synced: true,
  },
  {
    id: 'rm103', clientId: 'rc3', agentId: 'r3', date: 'Jul 8', time: '11:05 AM', location: 'Client Office',
    contact: 'V. Ocampo', position: 'Purchasing', custType: 'New', agenda: ['Price negotiation / quotation'],
    remarks: 'Hihintayin ang quotation approval sa main branch.', outcome: 'follow', meetingMode: 'in_person',
    gps: '14.4225° N, 121.0412° E', tagAlong: false, synced: false,
  },
  {
    id: 'rm102', clientId: 'rc5', agentId: 'r4', date: 'Jul 7', time: '4:15 PM', location: 'Client Office',
    contact: 'T. Lakandula', position: 'Owner', custType: 'Existing', agenda: ['Collection', 'Relationship building'],
    remarks: 'Na-settle ang balanse, tuloy ang monthly order.', outcome: 'success', meetingMode: 'in_person',
    gps: '16.4023° N, 120.5960° E', tagAlong: false, synced: true,
  },
  {
    // ADR-012 online meeting — GPS = agent's own location.
    id: 'rm101', clientId: 'rc2', agentId: 'r2', date: 'Jul 5', time: '10:30 AM', location: 'Online (video call)',
    contact: '—', position: '—', custType: 'Prospect', agenda: ['New business opportunity'],
    remarks: 'Unang usapan via video call; site visit ang susunod.', outcome: 'nodec', meetingMode: 'online',
    gps: '14.3294° N, 120.9367° E', tagAlong: false, synced: true,
  },
];

const RSR_APPROVALS: TeamApproval[] = [
  { id: 'rap1', type: 'edit', clientId: 'rc4', agentId: 'r2', field: 'Sales Channel', from: 'End-User', to: 'Dealer', requested: 'Jul 8' },
  { id: 'rap2', type: 'reassign', clientId: 'rc2', agentId: 'r2', toAgentId: 'r3', requested: 'Jul 9' },
  { id: 'rap3', type: 'tagalong', clientId: 'rc1', agentId: 'r1', meetingId: 'rm104', requested: 'Jul 9' },
];

const RSR_TAG_ALONG_REQUESTS: TagAlongRequest[] = [
  { id: 'rta1', agentId: 'r5', clientId: 'rc6', note: 'Bagong dealer sa Laguna — sama ka sana sa intro visit bukas.' },
];

// ─── Track-selected accessors ──────────────────────────────────────────────────

interface ManagerDataset {
  agents: TeamAgent[];
  clients: TeamClient[];
  meetings: TeamMeeting[];
  approvals: TeamApproval[];
  tagAlongRequests: TagAlongRequest[];
}

const DATASETS: Record<ManagerTrack, ManagerDataset> = {
  sales: {
    agents: SALES_AGENTS,
    clients: SALES_CLIENTS,
    meetings: SALES_MEETINGS,
    approvals: SALES_APPROVALS,
    tagAlongRequests: SALES_TAG_ALONG_REQUESTS,
  },
  rsr: {
    agents: RSR_AGENTS,
    clients: RSR_CLIENTS,
    meetings: RSR_MEETINGS,
    approvals: RSR_APPROVALS,
    tagAlongRequests: RSR_TAG_ALONG_REQUESTS,
  },
};

function dataset(): ManagerDataset {
  return DATASETS[activeTrack];
}

export function getManagerAgents(): TeamAgent[] {
  return dataset().agents;
}
export function getManagerClients(): TeamClient[] {
  return dataset().clients;
}
export function getManagerMeetings(): TeamMeeting[] {
  return dataset().meetings;
}
export function getManagerApprovals(): TeamApproval[] {
  return dataset().approvals;
}
export function getManagerTagAlongRequests(): TagAlongRequest[] {
  return dataset().tagAlongRequests;
}

export function agentById(id: string): TeamAgent | undefined {
  return dataset().agents.find((a) => a.id === id);
}
export function clientById(id: string): TeamClient | undefined {
  return dataset().clients.find((c) => c.id === id);
}
export function meetingById(id: string): TeamMeeting | undefined {
  return dataset().meetings.find((m) => m.id === id);
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
  meetings: TeamMeeting[] = dataset().meetings
): TeamClientProgressBreakdown {
  const presented = meetings.some(
    (m) => m.clientId === client.id && m.agenda.includes('Product / company presentation')
  );
  return { presented, total: presented ? 100 : 0 };
}

export function computeTeamClientProgress(client: TeamClient, meetings: TeamMeeting[] = dataset().meetings): number {
  return getTeamClientProgressBreakdown(client, meetings).total;
}

export function meetingsForClient(clientId: string): TeamMeeting[] {
  return dataset().meetings.filter((m) => m.clientId === clientId);
}
export function meetingsForAgent(agentId: string): TeamMeeting[] {
  return dataset().meetings.filter((m) => m.agentId === agentId);
}
export function clientsForAgent(agentId: string): TeamClient[] {
  return dataset().clients.filter((c) => c.agentId === agentId);
}
export function pendingApprovalForClient(clientId: string): TeamApproval | undefined {
  return dataset().approvals.find((a) => a.clientId === clientId && a.type !== 'tagalong');
}
