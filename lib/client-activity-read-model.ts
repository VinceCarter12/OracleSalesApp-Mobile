import { useCallback, useEffect, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ClientStatus } from '../types';
import { getDb } from './db';
import { getActiveDraftsForAgent, type MeetingDraft } from './meeting-drafts';
import { subscribeSyncComplete } from './sync/sync-events';
import { useAppDb } from './app-db-provider';
import { useSession } from './session-store';

export type TagAlongActivityState = 'none' | 'queued' | 'failed' | 'pending' | 'accepted' | 'declined' | 'cancelled';
export type PoActivityState = 'none' | 'draft' | 'queued' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'duplicate_blocked';

export interface ClientActivityReadModel {
  clientId: string;
  lifecycle: ClientStatus;
  meetingCount: number;
  latestMeetingAt: string | null;
  activeDraft: MeetingDraft | null;
  tagAlong: TagAlongActivityState;
  po: PoActivityState;
  cycleId: string | null;
  cycleDataAvailable: boolean;
  /** True when the card cannot make a current-cycle PO claim from local data. */
  cycleDataStale: boolean;
}

interface MeetingAggregateRow { client_id: string; meeting_count: number; latest_meeting_at: string | null; }
interface TagAlongRow { related_client_id: string; status: string; sync_status: string; created_at?: string; }
interface PoRow { client_id: string; cycle_id: string; status: string; synced_at: string | null; created_at?: string; }

export interface ClientActivityInput { id: string; status?: ClientStatus | null; cycle_id?: string | null; }

/** Pure, deterministic status selectors used by cards and tests. */
export function selectTagAlongState(rows: readonly Pick<TagAlongRow, 'status' | 'sync_status'>[]): TagAlongActivityState {
  const active = rows.find((row) => row.status === 'pending' || row.status === 'accepted' || row.status === 'declined' || row.status === 'cancelled');
  if (!active) return 'none';
  if (active.status === 'pending') {
    if (active.sync_status === 'synced') return 'pending';
    if (active.sync_status === 'pending') return 'queued';
    return 'failed';
  }
  return active.status as TagAlongActivityState;
}

export function selectPoState(rows: readonly Pick<PoRow, 'status' | 'synced_at'>[]): PoActivityState {
  // Rows are newest-first; the newest request is authoritative for the card.
  const newest = rows[0];
  if (!newest) return 'none';
  // A terminal/blocked newer row cannot mask an older active reservation.
  const active = rows.find((row) => row.status === 'draft' || row.status === 'pending' || row.status === 'approved');
  if (!active && newest.status === 'duplicate_blocked') return 'duplicate_blocked';
  if (!active) return newest.status === 'rejected' || newest.status === 'cancelled' ? newest.status as PoActivityState : 'none';
  if (active.status === 'draft') return active.synced_at ? 'pending' : 'draft';
  if (active.status === 'pending') return active.synced_at ? 'pending' : 'queued';
  return active.status as PoActivityState;
}

/** Duplicate preflight is deliberately local-only in Batch 1. */
export function selectCyclePoState(
  rows: readonly Pick<PoRow, 'cycle_id' | 'status' | 'synced_at'>[],
  cycleId: string | null
): PoActivityState {
  if (!cycleId) return 'none';
  const cycleRows = rows.filter((row) => row.cycle_id === cycleId);
  return selectPoState(cycleRows);
}

export async function readClientActivityModels(
  clients: readonly ClientActivityInput[],
  agentId: string,
  db?: Pick<SQLiteDatabase, 'getAllAsync'>,
): Promise<ClientActivityReadModel[]> {
  if (clients.length === 0) return [];
  const localDb = db ?? await getDb();
  const ids = clients.map((client) => client.id);
  const placeholders = ids.map(() => '?').join(',');
  const [meetings, tagAlong, po, drafts] = await Promise.all([
    localDb.getAllAsync<MeetingAggregateRow>(
      `SELECT client_id, COUNT(*) AS meeting_count, MAX(COALESCE(start_captured_at, logged_at)) AS latest_meeting_at
         FROM meetings WHERE agent_id = ? AND client_id IN (${placeholders}) GROUP BY client_id`,
      [agentId, ...ids],
    ),
    localDb.getAllAsync<TagAlongRow>(
      `SELECT related_client_id, status, sync_status, created_at FROM tag_along_requests
        WHERE requester_id = ? AND context = 'meeting' AND related_client_id IN (${placeholders})
        ORDER BY created_at DESC`,
      [agentId, ...ids],
    ),
    localDb.getAllAsync<PoRow>(
      `SELECT client_id, cycle_id, status, synced_at, created_at FROM po_confirmation_requests
        WHERE requester_id = ? AND client_id IN (${placeholders}) ORDER BY created_at DESC`,
      [agentId, ...ids],
    ),
    getActiveDraftsForAgent(agentId),
  ]);
  const meetingByClient = new Map(meetings.map((row) => [row.client_id, row]));
  const tagsByClient = new Map<string, TagAlongRow[]>();
  for (const row of tagAlong) { const list = tagsByClient.get(row.related_client_id) ?? []; list.push(row); tagsByClient.set(row.related_client_id, list); }
  const poByClient = new Map<string, PoRow[]>();
  for (const row of po) { const list = poByClient.get(row.client_id) ?? []; list.push(row); poByClient.set(row.client_id, list); }
  const draftByClient = new Map(drafts.map((draft) => [draft.clientId, draft]));
  return clients.map((client) => {
    const meeting = meetingByClient.get(client.id);
    const cycleId = client.cycle_id ?? null;
    return {
      clientId: client.id,
      lifecycle: client.status ?? 'prospect',
      meetingCount: Number(meeting?.meeting_count ?? 0),
      latestMeetingAt: meeting?.latest_meeting_at ?? null,
      activeDraft: draftByClient.get(client.id) ?? null,
      tagAlong: selectTagAlongState(tagsByClient.get(client.id) ?? []),
      po: selectCyclePoState(poByClient.get(client.id) ?? [], cycleId),
      cycleId,
      cycleDataAvailable: cycleId !== null,
      cycleDataStale: (client.status === 'new' || client.status === 'existing') && cycleId === null,
    };
  });
}

export function useClientActivityReadModel(clients: readonly ClientActivityInput[]): {
  activities: ClientActivityReadModel[]; loading: boolean; error: Error | null; refresh: () => Promise<void>;
} {
  const db = useAppDb();
  const { profileId } = useSession();
  const [activities, setActivities] = useState<ClientActivityReadModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const idsKey = clients.map((client) => `${client.id}:${client.status ?? ''}:${client.cycle_id ?? ''}`).join('|');
  const refresh = useCallback(async () => {
    if (!profileId) { setActivities([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setActivities(await readClientActivityModels(clients, profileId, db)); }
    catch (cause) { setError(cause instanceof Error ? cause : new Error(String(cause))); }
    finally { setLoading(false); }
  }, [db, idsKey, profileId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => subscribeSyncComplete(refresh), [refresh]);
  return { activities, loading, error, refresh };
}
