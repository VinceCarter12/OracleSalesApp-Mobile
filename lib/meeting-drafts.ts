import { getDb } from './db';
import type { MeetingMode } from '../types';

// ADR-026 P1 item 3 (Meeting Draft Recovery): local-only persistence for an
// in-progress meeting so the fast path's Start GPS+timestamp survives an app
// crash/kill. This module NEVER touches the outbox, never syncs to Supabase,
// and is not an entity-registry entry (see lib/db.ts's `meeting_drafts`
// migration) — it exists purely for on-device crash recovery, same
// single-write-path-per-responsibility convention as lib/client-service.ts /
// lib/meeting-service.ts.

/** What's persisted on Start — deliberately just the GPS+timestamp lock, not agenda ticks (those are cheap to re-derive, GPS/time are not). */
export interface MeetingDraftPayload {
  mode: MeetingMode;
  gpsLat: number;
  gpsLng: number;
  capturedAt: string;
}

export interface MeetingDraft {
  id: string;
  clientId: string;
  agentId: string;
  flow: 'full' | 'visit';
  payload: MeetingDraftPayload;
  startCapturedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MeetingDraftRow {
  id: string;
  client_id: string;
  agent_id: string;
  flow: string;
  payload_json: string;
  start_captured_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One draft per client, by design (spec: "upsert by a stable id ... so
 * re-starting overwrites rather than accumulates") — a deterministic id
 * keyed off the client, rather than a random UUID, makes the upsert trivial
 * and guarantees a second Start on the same client never orphans the first.
 */
function draftId(clientId: string): string {
  return `draft-${clientId}`;
}

/**
 * Same-day-only validity rule, compared by DEVICE-LOCAL calendar date.
 * `.toISOString().slice(0,10)` (the original implementation) compares UTC
 * dates instead — on a UTC+8 device a draft started at 1am local is still
 * "yesterday" in UTC until 8am local, so it was wrongly discarded as stale
 * on the very next check, while a draft started at 11pm local stayed
 * "valid" 8 hours into the next local day. `toDateString()` compares the
 * date in the runtime's local timezone, which is what "same day" means to
 * the agent holding the phone.
 */
function isSameCalendarDay(isoA: string, isoB: string): boolean {
  return new Date(isoA).toDateString() === new Date(isoB).toDateString();
}

export interface SaveDraftInput {
  clientId: string;
  agentId: string;
  flow: 'full' | 'visit';
  payload: MeetingDraftPayload;
}

/**
 * Upserts the single in-progress-meeting draft for a client. Cheap by
 * design — callers should write this once on Start, not on every render/
 * agenda-toggle tick.
 */
export async function saveDraft(input: SaveDraftInput): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = draftId(input.clientId);
  await db.runAsync(
    `INSERT INTO meeting_drafts (id, client_id, agent_id, flow, payload_json, start_captured_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       agent_id = excluded.agent_id,
       flow = excluded.flow,
       payload_json = excluded.payload_json,
       start_captured_at = excluded.start_captured_at,
       updated_at = excluded.updated_at`,
    [id, input.clientId, input.agentId, input.flow, JSON.stringify(input.payload), input.payload.capturedAt, now, now]
  );
}

/**
 * Returns the draft for a client, or null if none exists. A draft whose
 * `created_at` isn't today (device-local date) is treated as stale and
 * auto-discarded (deleted) rather than ever being offered for resume — never
 * resume a multi-day-old draft.
 *
 * Scoped to `agentId`: a shared device can log out and back in as a
 * different agent mid-day (session-store.tsx). Without this check, Agent B
 * could resume Agent A's GPS/timestamp lock and complete the meeting under
 * their own profileId — a real attribution bug, not just a UX nit. A
 * mismatched-agent draft is left alone (not deleted) so the original agent
 * can still resume it after logging back in, within the same day.
 */
export async function getDraftForClient(clientId: string, agentId: string): Promise<MeetingDraft | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MeetingDraftRow>(
    'SELECT * FROM meeting_drafts WHERE id = ?',
    [draftId(clientId)]
  );
  if (!row) return null;
  if (row.agent_id !== agentId) return null;

  if (!isSameCalendarDay(row.created_at, new Date().toISOString())) {
    await deleteDraft(clientId);
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    agentId: row.agent_id,
    flow: row.flow === 'full' ? 'full' : 'visit',
    payload: JSON.parse(row.payload_json) as MeetingDraftPayload,
    startCapturedAt: row.start_captured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Deletes a client's draft, if any — called after a successful save, on explicit discard, and when a draft is found stale or orphaned (client no longer exists locally). */
export async function deleteDraft(clientId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meeting_drafts WHERE id = ?', [draftId(clientId)]);
}
