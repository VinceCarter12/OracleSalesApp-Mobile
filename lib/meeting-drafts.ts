import { getDb } from './db';
import { isSameCalendarDay } from './local-day';
import type { MeetingMode } from '../types';
import { normalizeMeetingDraftPayload, type MeetingDraftPayload } from './policies/meeting-draft-policy';
import { uuidv4 } from './uuid';
export { companionsForDraft, normalizeMeetingDraftPayload, restoreCompanionsFromDraft } from './policies/meeting-draft-policy';
export type { MeetingDraftCompanion } from './policies/meeting-draft-policy';

// ADR-026 P1 item 3 (Meeting Draft Recovery): local-only persistence for an
// in-progress meeting so the fast path's Start GPS+timestamp survives an app
// crash/kill. This module NEVER touches the outbox, never syncs to Supabase,
// and is not an entity-registry entry (see lib/db.ts's `meeting_drafts`
// migration) — it exists purely for on-device crash recovery, same
// single-write-path-per-responsibility convention as lib/client-service.ts /
// lib/meeting-service.ts.

/** What's persisted on Start — deliberately just the GPS+timestamp lock, not agenda ticks (those are cheap to re-derive, GPS/time are not). */
export type { MeetingDraftPayload } from './policies/meeting-draft-policy';

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

export interface SaveDraftInput {
  clientId: string;
  agentId: string;
  flow: 'full' | 'visit';
  payload: MeetingDraftPayload;
}

/** Raised when an agent tries to start a second same-day meeting. */
export class OngoingMeetingLimitError extends Error {
  constructor() {
    super('Only one ongoing meeting is allowed.');
    this.name = 'OngoingMeetingLimitError';
  }
}

/**
 * The draft row is the durable source of truth for an ongoing meeting. This
 * check intentionally lives beside the write, not only in a screen, so the
 * full form, fast path, and Manager re-exports cannot drift apart.
 */
export async function hasOtherActiveDraftForAgent(agentId: string, clientId: string): Promise<boolean> {
  const activeDrafts = await getActiveDraftsForAgent(agentId);
  return activeDrafts.some((draft) => draft.clientId !== clientId);
}

// Serializes Start writes in this JS runtime. The write-time guard below is
// still required even when the UI preflight has already passed: two entry
// screens can otherwise both observe an empty draft list before either writes.
let draftWriteQueue: Promise<void> = Promise.resolve();
let draftMigrationQueue: Promise<void> = Promise.resolve();

async function withDraftWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = draftWriteQueue;
  let release!: () => void;
  draftWriteQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function withDraftMigrationLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = draftMigrationQueue;
  let release: () => void = () => undefined;
  draftMigrationQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await operation(); } finally { release(); }
}

/**
 * Upserts the single in-progress-meeting draft for a client. Cheap by
 * design — callers should write this once on Start, not on every render/
 * agenda-toggle tick.
 */
export async function saveDraft(input: SaveDraftInput): Promise<void> {
  await withDraftWriteLock(async () => {
    if (await hasOtherActiveDraftForAgent(input.agentId, input.clientId)) {
      throw new OngoingMeetingLimitError();
    }
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
  });
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
  return withDraftMigrationLock(() => getDraftForClientUnlocked(clientId, agentId));
}

async function getDraftForClientUnlocked(clientId: string, agentId: string): Promise<MeetingDraft | null> {
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

  const rawPayload = JSON.parse(row.payload_json) as Record<string, unknown>;
  const parsedPayload = normalizeMeetingDraftPayload(rawPayload);
  const payload: MeetingDraftPayload = { ...parsedPayload, operationId: parsedPayload.operationId ?? uuidv4() };
  // Older drafts predate the operation ID. Persist the generated ID now so
  // relaunch/recovery and every later save continue using one canonical ID.
  if (!parsedPayload.operationId) {
    await db.runAsync('UPDATE meeting_drafts SET payload_json = ?, updated_at = ? WHERE id = ? AND payload_json = ?', [
      JSON.stringify(payload), new Date().toISOString(), row.id, row.payload_json,
    ]);
    const canonical = await db.getFirstAsync<MeetingDraftRow>('SELECT * FROM meeting_drafts WHERE id = ?', [row.id]);
    if (canonical) {
      const canonicalPayload = normalizeMeetingDraftPayload(JSON.parse(canonical.payload_json));
      return getDraftFromRow(canonical, { ...canonicalPayload, operationId: canonicalPayload.operationId ?? payload.operationId });
    }
  }
  return getDraftFromRow(row, payload);
}

function getDraftFromRow(row: MeetingDraftRow, payload: MeetingDraftPayload): MeetingDraft {
  return { id: row.id, clientId: row.client_id, agentId: row.agent_id, flow: row.flow === 'full' ? 'full' : 'visit', payload, startCapturedAt: row.start_captured_at, createdAt: row.created_at, updatedAt: row.updated_at };
}

/** Deletes a client's draft, if any — called after a successful save, on explicit discard, and when a draft is found stale or orphaned (client no longer exists locally). */
export async function deleteDraft(clientId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meeting_drafts WHERE id = ?', [draftId(clientId)]);
}

/**
 * All of this agent's same-day, still-valid drafts — powers the "meeting in
 * progress" dashboard/My Clients indicators, so a navigating-away agent
 * still sees (and can jump back to) an unfinished meeting from anywhere in
 * the app instead of only from that one client's own screen. Most-recently-
 * started first. Reuses `getDraftForClient`'s staleness rule (drop anything
 * not created today) by filtering + deleting inline, same as that function.
 */
export async function getActiveDraftsForAgent(agentId: string): Promise<MeetingDraft[]> {
  return withDraftMigrationLock(() => getActiveDraftsForAgentUnlocked(agentId));
}

async function getActiveDraftsForAgentUnlocked(agentId: string): Promise<MeetingDraft[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MeetingDraftRow>(
    'SELECT * FROM meeting_drafts WHERE agent_id = ? ORDER BY start_captured_at DESC',
    [agentId]
  );
  const now = new Date().toISOString();
  const active: MeetingDraft[] = [];
  for (const row of rows) {
    if (!isSameCalendarDay(row.created_at, now)) {
      await deleteDraft(row.client_id);
      continue;
    }
    const parsedPayload = normalizeMeetingDraftPayload(JSON.parse(row.payload_json));
    const payload: MeetingDraftPayload = { ...parsedPayload, operationId: parsedPayload.operationId ?? uuidv4() };
    if (!parsedPayload.operationId) {
      await db.runAsync('UPDATE meeting_drafts SET payload_json = ?, updated_at = ? WHERE id = ? AND payload_json = ?', [
        JSON.stringify(payload), new Date().toISOString(), row.id, row.payload_json,
      ]);
      const canonical = await db.getFirstAsync<MeetingDraftRow>('SELECT * FROM meeting_drafts WHERE id = ?', [row.id]);
      if (canonical) {
        const canonicalPayload = normalizeMeetingDraftPayload(JSON.parse(canonical.payload_json));
        active.push(getDraftFromRow(canonical, { ...canonicalPayload, operationId: canonicalPayload.operationId ?? payload.operationId }));
        continue;
      }
    }
    active.push(getDraftFromRow(row, payload));
  }
  return active;
}
