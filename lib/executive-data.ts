import { COLORS } from './theme';
import type { ClientStatus } from '../types';

/**
 * Executive mock data — mirrors Wireframe-Agent-Executive.html's x* arrays 1:1
 * (managers, agents, clients, meetings, lostOpp, approvalsLog) so the app and
 * the spec of record (ADR-010) never disagree. The Executive is the only
 * mobile persona that sees BOTH tracks (Sales + RSR) together, view-only —
 * approvals stay with the managers. No executive aggregate queries exist in
 * Supabase yet; swap for real queries once that backend work is scoped.
 */

export interface ExecAvatarStyle {
  background: string;
  color: string;
}

export interface ExecManager {
  id: string;
  name: string;
  initials: string;
  avatar: ExecAvatarStyle;
  meetings: number;
  clients: number;
  agentCount: number;
  track: 'sales' | 'rsr';
}

export interface ExecAgent {
  id: string;
  managerId: string;
  name: string;
  initials: string;
  avatar: ExecAvatarStyle;
  meetings: number;
  clients: number;
  rate: number;
}

export interface ExecClientChecklist {
  name: boolean;
  contact: boolean;
  number: boolean;
  address: boolean;
  channel: boolean;
}

export interface ExecClient {
  id: string;
  name: string;
  agentId: string;
  managerId: string;
  status: ClientStatus;
  channel: string;
  checklist: ExecClientChecklist;
}

export interface ExecMeeting {
  id: string;
  clientId: string;
  agentId: string;
  date: string;
  time: string;
  location: string;
  contact: string;
  position: string;
  agenda: string[];
  remarks: string;
  outcome: 'success' | 'follow' | 'nodec' | 'lost';
  gps: string;
  synced: boolean;
}

export type ExecLostOppStatus = 'admin-list' | 'released' | 'claimed';

export interface ExecLostOpp {
  id: string;
  name: string;
  managerId: string;
  agentId: string;
  lostDate: string;
  status: ExecLostOppStatus;
  claimedBy?: string;
  reason: string;
}

export interface ExecApprovalLogEntry {
  id: string;
  managerName: string;
  clientName: string;
  type: 'edit' | 'reassign';
  field?: string;
  decision: 'approved' | 'rejected';
  date: string;
}

export const EXEC_MANAGERS: ExecManager[] = [
  { id: 'x1', name: 'Erika Bautista', initials: 'EB', avatar: { background: COLORS.purpleSoft, color: COLORS.purple }, meetings: 61, clients: 96, agentCount: 4, track: 'sales' },
  { id: 'x2', name: 'Carlo Mendoza', initials: 'CM', avatar: { background: COLORS.blueSoft, color: COLORS.blue }, meetings: 48, clients: 74, agentCount: 4, track: 'sales' },
  { id: 'x3', name: 'Divina Reyes', initials: 'DR', avatar: { background: COLORS.amberSoft, color: COLORS.orange }, meetings: 34, clients: 48, agentCount: 4, track: 'sales' },
  { id: 'x4', name: 'Rommel Aquino', initials: 'RA', avatar: { background: COLORS.greenTint, color: COLORS.ledgeGreen }, meetings: 52, clients: 0, agentCount: 5, track: 'rsr' },
];

export const EXEC_AGENTS: ExecAgent[] = [
  { id: 'xa1', managerId: 'x1', name: 'Miguel Santos', initials: 'MS', avatar: { background: COLORS.greenTint, color: COLORS.ledgeGreen }, meetings: 14, clients: 22, rate: 72 },
  { id: 'xa2', managerId: 'x1', name: 'Ana Reyes', initials: 'AR', avatar: { background: COLORS.blueSoft, color: COLORS.blue }, meetings: 19, clients: 28, rate: 81 },
  { id: 'xa3', managerId: 'x2', name: 'Paolo Cruz', initials: 'PC', avatar: { background: COLORS.amberSoft, color: COLORS.orange }, meetings: 11, clients: 20, rate: 58 },
  { id: 'xa4', managerId: 'x3', name: 'Jenny Lim', initials: 'JL', avatar: { background: COLORS.purpleSoft, color: COLORS.purple }, meetings: 17, clients: 26, rate: 76 },
];

export const EXEC_CLIENTS: ExecClient[] = [
  { id: 'xc1', name: 'Oracle Petroleum (Bataan)', agentId: 'xa1', managerId: 'x1', status: 'prospect', channel: 'Distributor', checklist: { name: true, contact: true, number: true, address: false, channel: false } },
  { id: 'xc2', name: 'RMC Fuels Inc.', agentId: 'xa2', managerId: 'x1', status: 'new', channel: 'Dealer', checklist: { name: true, contact: true, number: true, address: true, channel: true } },
  { id: 'xc3', name: 'MetroTrans Logistics', agentId: 'xa3', managerId: 'x2', status: 'prospect', channel: '—', checklist: { name: true, contact: false, number: false, address: false, channel: false } },
  { id: 'xc4', name: 'PetroGo (Pampanga)', agentId: 'xa4', managerId: 'x3', status: 'existing', channel: 'Distributor', checklist: { name: true, contact: true, number: true, address: true, channel: true } },
];

export const EXEC_MEETINGS: ExecMeeting[] = [
  { id: 'xm101', clientId: 'xc1', agentId: 'xa1', date: 'Jul 6', time: '9:41 AM', location: 'Client Office', contact: 'J. Cruz', position: 'Purchasing', agenda: ['New business opportunity'], remarks: 'Interesado sa bulk order.', outcome: 'success', gps: '14.5547° N, 120.9842° E', synced: false },
  { id: 'xm102', clientId: 'xc2', agentId: 'xa2', date: 'Jul 4', time: '2:15 PM', location: 'Starbucks Alabang', contact: 'M. Villar', position: 'Owner', agenda: ['Price negotiation / quotation'], remarks: 'Hihintayin ang budget approval.', outcome: 'follow', gps: '14.4187° N, 121.0450° E', synced: true },
];

export const EXEC_LOST_OPP: ExecLostOpp[] = [
  { id: 'xl1', name: 'GH Trading', managerId: 'x2', agentId: 'xa3', lostDate: 'Jun 30', status: 'admin-list', reason: 'Hindi na sumasagot, ilang beses ng huli sa bayad' },
  { id: 'xl2', name: 'BenX Motors', managerId: 'x3', agentId: 'xa4', lostDate: 'Jun 15', status: 'released', reason: 'Naging inactive matagal na' },
  { id: 'xl3', name: 'Amihan Supplies', managerId: 'x1', agentId: 'xa2', lostDate: 'May 28', status: 'claimed', claimedBy: 'Paolo Cruz', reason: 'Nagpalit ng supplier' },
];

export const EXEC_APPROVALS_LOG: ExecApprovalLogEntry[] = [
  { id: 'xg1', managerName: 'Erika Bautista', clientName: 'Oracle Petroleum (Bataan)', type: 'edit', field: 'Sales Channel', decision: 'approved', date: 'Jul 5' },
  { id: 'xg2', managerName: 'Carlo Mendoza', clientName: 'MetroTrans Logistics', type: 'reassign', decision: 'rejected', date: 'Jul 4' },
  { id: 'xg3', managerName: 'Divina Reyes', clientName: 'PetroGo (Pampanga)', type: 'edit', field: 'Customer Type', decision: 'approved', date: 'Jul 3' },
];

export function execManagerById(id: string): ExecManager | undefined {
  return EXEC_MANAGERS.find((m) => m.id === id);
}
export function execAgentById(id: string): ExecAgent | undefined {
  return EXEC_AGENTS.find((a) => a.id === id);
}
export function execClientById(id: string): ExecClient | undefined {
  return EXEC_CLIENTS.find((c) => c.id === id);
}
export function execMeetingById(id: string): ExecMeeting | undefined {
  return EXEC_MEETINGS.find((m) => m.id === id);
}
export function execAgentsForManager(managerId: string): ExecAgent[] {
  return EXEC_AGENTS.filter((a) => a.managerId === managerId);
}
export function execClientsForAgent(agentId: string): ExecClient[] {
  return EXEC_CLIENTS.filter((c) => c.agentId === agentId);
}
export function execMeetingsForAgent(agentId: string): ExecMeeting[] {
  return EXEC_MEETINGS.filter((m) => m.agentId === agentId);
}
export function execMeetingsForClient(clientId: string): ExecMeeting[] {
  return EXEC_MEETINGS.filter((m) => m.clientId === clientId);
}

/**
 * B-001 (final, 2026-07-11): progress % is 100% once a saved meeting's Agenda
 * includes "Product / company presentation," 0% otherwise — info completion
 * has ZERO weight. Mirrors xComputeProgress() in the wireframe.
 */
export function computeExecClientProgress(client: ExecClient): number {
  const presented = EXEC_MEETINGS.some(
    (m) => m.clientId === client.id && m.agenda.includes('Product / company presentation')
  );
  return presented ? 100 : 0;
}
