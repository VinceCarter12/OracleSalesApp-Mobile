import { getDb } from './db';
import { uuidv4 } from './uuid';
import { enqueueOutboxRow } from './sync/entity-registry';
import { runSync } from './sync-engine';
import { supabase } from './supabase';
import type { UserRole } from '../types';
import { canReadManagerDirectory } from './manager-directory-policy';

export type JointManagerRequestStatus = 'pending' | 'approved' | 'declined';
export type JointManagerDecision = 'pending' | 'approved' | 'declined';

export interface JointManagerRequest {
  id: string; clientId: string; requesterId: string; originTeamId: string | null;
  managerIds: string[]; status: JointManagerRequestStatus; requiredCount: 1 | 2;
  createdAt: string; updatedAt: string; appliedAt: string | null; approvedCount: number; declinedCount: number; managerNames: string[];
}

interface LocalRequestRow { id: string; client_id: string; requester_id: string; origin_team_id: string | null; manager_ids: string | string[]; status: JointManagerRequestStatus; required_count: number; created_at: string; updated_at: string; applied_at: string | null; }

function fromRow(row: LocalRequestRow & { manager_names?: string[] }): JointManagerRequest {
  const ids = Array.isArray(row.manager_ids) ? row.manager_ids : JSON.parse(row.manager_ids) as unknown;
  if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) throw new Error('Invalid manager request data');
  const names = Array.isArray(row.manager_names) ? row.manager_names.filter((name): name is string => typeof name === 'string') : [];
  return { id: row.id, clientId: row.client_id, requesterId: row.requester_id, originTeamId: row.origin_team_id, managerIds: ids, managerNames: names, status: row.status, requiredCount: row.required_count === 2 ? 2 : 1, createdAt: row.created_at, updatedAt: row.updated_at, appliedAt: row.applied_at, approvedCount: 0, declinedCount: 0 };
}

export async function createJointManagerRequest(clientId: string, requesterId: string, managerIds: readonly string[], originTeamId: string | null = null): Promise<string> {
  const ids = Array.from(new Set(managerIds));
  if (ids.length < 1 || ids.length > 2) throw new Error('Select one or two Managers.');
  const id = uuidv4();
  const now = new Date().toISOString();
  const db = await getDb();
  const client = await db.getFirstAsync<{ updated_at: string }>('SELECT updated_at FROM clients WHERE id = ?', [clientId]);
  if (!client) throw new Error('Client is not available offline yet. Sync first, then try again.');
  await db.withTransactionAsync(async () => {
    await db.runAsync(`INSERT INTO joint_manager_requests (id, client_id, requester_id, origin_team_id, manager_ids, action_kind, action_payload, base_updated_at, status, required_count, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, 'holder_assignment', '{}', ?, 'pending', ?, ?, ?, 'pending')`, [id, clientId, requesterId, originTeamId, JSON.stringify(ids), client.updated_at, ids.length, now, now]);
    await enqueueOutboxRow(db, { outboxId: uuidv4(), recordId: id, tableName: 'joint_manager_requests', operation: 'insert', payload: JSON.stringify({ id, client_id: clientId, requester_id: requesterId, origin_team_id: originTeamId, manager_ids: ids, action_kind: 'holder_assignment', action_payload: {}, base_updated_at: client.updated_at, required_count: ids.length, status: 'pending', created_at: now, updated_at: now }), createdAt: now, createdOnline: false });
  });
  runSync(requesterId).catch((error: unknown) => console.warn('[joint-manager] sync failed', error));
  return id;
}

export async function listMyJointManagerRequests(requesterId: string): Promise<JointManagerRequest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LocalRequestRow>('SELECT * FROM joint_manager_requests WHERE requester_id = ? ORDER BY created_at DESC', [requesterId]);
  return rows.map(fromRow);
}

export async function fetchManagerJointRequests(): Promise<JointManagerRequest[]> {
  const { data, error } = await supabase.rpc('get_manager_joint_requests');
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((value) => {
    const row: LocalRequestRow & { approved_count: number; declined_count: number; manager_names?: string[] } = {
      id: String(value.id ?? ''), client_id: String(value.client_id ?? ''), requester_id: String(value.requester_id ?? ''),
      origin_team_id: typeof value.origin_team_id === 'string' ? value.origin_team_id : null,
      manager_ids: Array.isArray(value.manager_ids) ? value.manager_ids.filter((id): id is string => typeof id === 'string') : String(value.manager_ids ?? '[]'),
      status: value.status === 'approved' || value.status === 'declined' ? value.status : 'pending',
      required_count: value.required_count === 2 ? 2 : 1, created_at: String(value.created_at ?? ''), updated_at: String(value.updated_at ?? ''),
      applied_at: typeof value.applied_at === 'string' ? value.applied_at : null,
      approved_count: typeof value.approved_count === 'number' ? value.approved_count : 0,
      declined_count: typeof value.declined_count === 'number' ? value.declined_count : 0,
      manager_names: Array.isArray(value.manager_names) ? value.manager_names.filter((name): name is string => typeof name === 'string') : [],
    };
    return { ...fromRow(row), approvedCount: row.approved_count, declinedCount: row.declined_count };
  });
}

export async function fetchManagerDirectory(): Promise<Array<{ id: string; name: string; teamId: string | null }>> {
  const { data, error } = await supabase.rpc('get_manager_directory');
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; full_name: string; team_id: string | null }>).map((row) => ({ id: row.id, name: row.full_name, teamId: row.team_id }));
}

export interface LocalManagerDirectoryEntry { id: string; name: string; teamId: string | null; }

/** Reads only the server-authorized directory mirror; never falls back to a team roster. */
export async function getLocalManagerDirectory(viewerRole: UserRole | null): Promise<LocalManagerDirectoryEntry[]> {
  if (!canReadManagerDirectory(viewerRole)) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<{ profile_id: string; full_name: string; team_id: string | null }>(
    `SELECT profile_id, full_name, team_id FROM manager_directory_snapshot
      WHERE is_active = 1 ORDER BY full_name COLLATE NOCASE`
  );
  return rows.map((row) => ({ id: row.profile_id, name: row.full_name, teamId: row.team_id }));
}

export function isManagerDirectoryViewer(role: UserRole | null): boolean {
  return canReadManagerDirectory(role);
}

export async function decideJointManagerRequest(requestId: string, decision: Exclude<JointManagerDecision, 'pending'>): Promise<string> {
  const { data, error } = await supabase.rpc('decide_joint_manager_request', { p_request_id: requestId, p_decision: decision });
  if (error) throw error;
  const result = data as { ok?: boolean; code?: string };
  if (!result.ok) throw new Error(result.code ?? 'Decision failed');
  return result.code ?? 'pending';
}

export async function getClientRecordHolders(clientId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ manager_id: string }>('SELECT manager_id FROM client_record_holders WHERE client_id = ? AND active = 1', [clientId]);
  return rows.map((row) => row.manager_id);
}

export async function getClientHolderNames(clientId: string): Promise<string[]> {
  const ids = await getClientRecordHolders(clientId);
  if (ids.length === 0) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<{ manager_id: string; manager_name: string | null }>(`SELECT manager_id, manager_name FROM client_record_holders WHERE client_id = ? AND active = 1`, [clientId]);
  const names = new Map(rows.map((row) => [row.manager_id, row.manager_name ?? 'Manager']));
  return ids.map((id) => names.get(id) ?? 'Manager');
}
