import { File } from 'expo-file-system';
import { getDb } from './db';
import { uuidv4 } from './uuid';
import { supabase } from './supabase';
import { isLikelyOnline } from './sync/connectivity';
import { withTimeout } from './with-timeout';
import { MEETING_PHOTO_BUCKET, PHOTO_UPLOAD_TIMEOUT_MS } from './meeting-photo-service';
import {
  canAttemptSubmission,
  derivePoConfirmationDisplayStatus,
  PO_CONFIRMATION_REQUEST_KIND,
  type LocalPoConfirmationStatus,
  type PoConfirmationDisplayStatus,
} from './policies/po-confirmation-status-policy';
import type { SQLiteDatabase } from 'expo-sqlite';

// ADR-044 (Migration 039) + ADR-046 point 7 (Batch 3, Slice 5): the Sales/RSR
// requester-side read/write path for PO confirmation evidence. Mirrors
// lib/tag-along-service.ts's split (requester-side writes/reads here,
// Manager-side feed/decision in lib/po-confirmation-manager-service.ts) —
// same 300-line-file reasoning that already split tag-along across three
// files (tag-along-service.ts / tag-along-invitee-service.ts /
// tag-along-manager-service.ts).
//
// UNLIKE tag_along_requests, this domain has NO outbox queueing (ADR-044
// decision 5: "No offline queueing... all approval actions are
// online-only") — capture always succeeds locally; submission is a
// best-effort direct Supabase call attempted only while online, matching
// the RLS policy Migration-039-Report.md documents ("Agents create own PO
// confirmation" — a plain INSERT policy, not a dedicated create-RPC).
//
// ⚠️ Migration 039's SQL creates no Storage bucket/policy for the PO photo
// (Migration-039-Report.md has no bucket DDL) — this reuses the existing
// `meeting-photos` bucket (lib/meeting-photo-service.ts) under a distinct
// path suffix, a judgment call flagged to Vince, not a confirmed spec.

export interface CapturePoEvidenceInput {
  clientId: string;
  cycleId: string;
  meetingId: string;
  requesterId: string;
  localPhotoUri: string;
}

interface LocalPoConfirmationRow {
  id: string;
  client_id: string;
  cycle_id: string;
  meeting_id: string;
  requester_id: string;
  po_photo_path: string;
  status: LocalPoConfirmationStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface PoConfirmationRecord {
  id: string;
  clientId: string;
  meetingId: string;
  poPhotoPath: string;
  status: LocalPoConfirmationStatus;
  displayStatus: PoConfirmationDisplayStatus;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

function toRecord(row: LocalPoConfirmationRow): PoConfirmationRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    meetingId: row.meeting_id,
    poPhotoPath: row.po_photo_path,
    status: row.status,
    displayStatus: derivePoConfirmationDisplayStatus(row.status),
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Step 1 (offline-safe): saves the captured photo's local URI as a `'draft'`
 * row. Never touches the network — same "meeting is never lost" spirit as
 * ADR-026 P1's photo-save fallback. Call `submitPoConfirmation()`
 * immediately after (best-effort) or later via a retry affordance once
 * online.
 */
export async function capturePoEvidenceLocally(
  db: SQLiteDatabase,
  input: CapturePoEvidenceInput
): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO po_confirmation_requests
      (id, client_id, cycle_id, meeting_id, requester_id, po_photo_path, status, created_at, updated_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, NULL)`,
    [id, input.clientId, input.cycleId, input.meetingId, input.requesterId, input.localPhotoUri, now, now]
  );
  return id;
}

export interface CaptureAndSubmitPoEvidenceInput extends CapturePoEvidenceInput {
  userId: string;
}

/**
 * Combines `capturePoEvidenceLocally()` + a best-effort
 * `submitPoConfirmation()` attempt — the single call site
 * `lib/meeting-service.ts::createMeeting()` uses right after its own
 * transaction commits (mirrors that function's existing "insert, then queue
 * the photo upload" best-effort pattern). Never throws — a capture or
 * submission failure must never undo or block the already-saved meeting.
 */
export async function captureAndSubmitPoEvidence(
  db: SQLiteDatabase,
  input: CaptureAndSubmitPoEvidenceInput
): Promise<void> {
  try {
    const requestId = await capturePoEvidenceLocally(db, input);
    await submitPoConfirmation(db, requestId, input.userId);
  } catch (err) {
    console.error('[po-confirmation-service] capture-and-submit failed:', err instanceof Error ? err.message : String(err));
  }
}

function buildPoEvidenceStoragePath(userId: string, requestId: string): string {
  return `meetings/${userId}/${requestId}-po-evidence.jpg`;
}

async function uploadPoEvidencePhoto(localUri: string, storagePath: string): Promise<string> {
  const bytes = await new File(localUri).bytes();
  const { error } = await withTimeout(
    supabase.storage.from(MEETING_PHOTO_BUCKET).upload(storagePath, bytes, { contentType: 'image/jpeg' }),
    PHOTO_UPLOAD_TIMEOUT_MS,
    `PO evidence upload (${storagePath})`
  );
  if (error) throw error;
  const { data } = supabase.storage.from(MEETING_PHOTO_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export type SubmitPoConfirmationResult = 'submitted' | 'skipped_not_draft' | 'offline' | 'failed';

/**
 * Step 2 (online-only, ADR-044 decision 5): uploads the captured photo, then
 * a direct RLS-gated INSERT into `po_confirmation_requests` (no dedicated
 * create-RPC exists — Migration-039-Report.md's "Agents create own PO
 * confirmation" policy is a plain INSERT policy). Never throws — a failure
 * leaves the local row `'draft'` so the UI can retry later; this must never
 * be allowed to undo or block the already-saved meeting it's attached to.
 */
export async function submitPoConfirmation(
  db: SQLiteDatabase,
  requestId: string,
  userId: string
): Promise<SubmitPoConfirmationResult> {
  const row = await db.getFirstAsync<LocalPoConfirmationRow>(
    'SELECT * FROM po_confirmation_requests WHERE id = ?',
    [requestId]
  );
  if (!row) return 'failed';

  const online = await isLikelyOnline();
  if (!canAttemptSubmission(row.status, online)) {
    return row.status !== 'draft' ? 'skipped_not_draft' : 'offline';
  }

  try {
    const storagePath = buildPoEvidenceStoragePath(userId, requestId);
    const publicUrl = await uploadPoEvidencePhoto(row.po_photo_path, storagePath);

    const remotePayload = {
      id: row.id,
      client_id: row.client_id,
      cycle_id: row.cycle_id,
      meeting_id: row.meeting_id,
      requester_id: row.requester_id,
      po_photo_path: publicUrl,
    };
    const { error } = await supabase.from('po_confirmation_requests').insert(remotePayload);
    if (error) throw error;

    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE po_confirmation_requests
         SET status = 'pending', po_photo_path = ?, updated_at = ?, synced_at = ?
       WHERE id = ?`,
      [publicUrl, now, now, requestId]
    );
    return 'submitted';
  } catch (err) {
    console.error('[po-confirmation-service] submission failed:', err instanceof Error ? err.message : String(err));
    return 'failed';
  }
}

/** Meeting Detail's PO status card — the (at most one, per the live unique-pending-per-cycle index) request attached to this meeting. */
export async function getPoConfirmationForMeeting(meetingId: string): Promise<PoConfirmationRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<LocalPoConfirmationRow>(
    'SELECT * FROM po_confirmation_requests WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1',
    [meetingId]
  );
  return row ? toRecord(row) : null;
}

interface RemoteMyRequestRow {
  request_kind: string;
  request_id: string;
  client_id: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  summary: Record<string, unknown>;
}

/**
 * Notifications' PO section: local drafts (never submitted) plus a
 * best-effort reconciliation against `get_my_request_statuses()` for
 * anything already submitted — a submitted row's local status is
 * overwritten with the server's current status (e.g. `'pending'` →
 * `'approved'`) so a stale local row never outlives an actual decision.
 * Read-only network call, safe to attempt regardless of connectivity (a
 * failure just means the local rows are shown as last known).
 */
export async function getMyPoConfirmationStatuses(requesterId: string): Promise<PoConfirmationRecord[]> {
  const db = await getDb();
  const localRows = await db.getAllAsync<LocalPoConfirmationRow>(
    'SELECT * FROM po_confirmation_requests WHERE requester_id = ? ORDER BY created_at DESC',
    [requesterId]
  );

  try {
    const { data, error } = await supabase.rpc('get_my_request_statuses');
    if (error) throw error;
    const remoteById = new Map(
      ((data ?? []) as RemoteMyRequestRow[])
        .filter((r) => r.request_kind === PO_CONFIRMATION_REQUEST_KIND)
        .map((r) => [r.request_id, r])
    );

    for (const row of localRows) {
      const remote = remoteById.get(row.id);
      if (!remote || remote.status === row.status) continue;
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE po_confirmation_requests
           SET status = ?, decided_at = ?, updated_at = ?, synced_at = ?
         WHERE id = ?`,
        [remote.status, remote.decided_at, now, now, row.id]
      );
      row.status = remote.status as LocalPoConfirmationStatus;
      row.decided_at = remote.decided_at;
    }
  } catch (err) {
    console.error('[po-confirmation-service] status reconciliation failed:', err instanceof Error ? err.message : String(err));
  }

  return localRows.map(toRecord);
}
