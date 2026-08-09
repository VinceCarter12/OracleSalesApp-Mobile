import { File } from 'expo-file-system';
import { getDb } from './db';
import { uuidv4 } from './uuid';
import { supabase } from './supabase';
import { isLikelyOnline } from './sync/connectivity';
import { withTimeout } from './with-timeout';
import { MEETING_PHOTO_BUCKET, PHOTO_UPLOAD_TIMEOUT_MS } from './meeting-photo-service';
import { RLS_PERMISSION_DENIED_CODE, UNIQUE_VIOLATION_CODE } from './sync/outbox-status';
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
  // `upsert: true` (same fix as lib/profile-avatar.ts): storagePath is
  // deterministic per requestId (buildPoEvidenceStoragePath), so a retried
  // submission for the same 'draft' row (retryDraftPoConfirmations, or a
  // second captureAndSubmitPoEvidence attempt) re-uploads the identical
  // path. Without upsert, Storage rejects the retry with "The resource
  // already exists" even though the object is already correct — turning a
  // recoverable retry into a permanent-looking failure.
  const { error } = await withTimeout(
    supabase.storage.from(MEETING_PHOTO_BUCKET).upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: true }),
    PHOTO_UPLOAD_TIMEOUT_MS,
    `PO evidence upload (${storagePath})`
  );
  if (error) throw error;
  const { data } = supabase.storage.from(MEETING_PHOTO_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * B-095 follow-up (2026-08-09, found via Vince's on-device console error):
 * `uploadPoEvidencePhoto()`'s Storage call can ALSO be rejected by RLS —
 * `storage.objects` is RLS-protected the same way `po_confirmation_requests`
 * is (Migration 034's folder policy), and Postgres/PostgREST report both
 * kinds of rejection with the identical message "new row violates row-level
 * security policy", just for a different underlying table. Before this fix,
 * ONLY the table-insert step below checked for this (via `error.code ===
 * RLS_PERMISSION_DENIED_CODE`) and terminated the row as `'superseded'` — a
 * Storage-side RLS rejection fell straight to the generic catch below,
 * leaving the row stuck `'draft'` and silently retried forever
 * (`retryDraftPoConfirmations()` runs on every Notifications-screen visit)
 * with no indication it would never succeed. The Supabase Storage JS client
 * doesn't reliably surface the Postgres SQLSTATE on its error object the way
 * `supabase-js`'s Postgrest client does (no guaranteed `.code`), so this
 * checks BOTH the code (covers the table-insert path) and the message text
 * (covers the Storage path, and is a safety net for the insert path too).
 */
function isRlsPermissionDenied(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === RLS_PERMISSION_DENIED_CODE) {
    return true;
  }
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return message.toLowerCase().includes('row-level security policy');
}

/** Shared terminal-state write for a permanently RLS-rejected request — see `isRlsPermissionDenied()`'s doc comment for why this now covers both the Storage upload and the table insert. */
async function markPoConfirmationSuperseded(db: SQLiteDatabase, requestId: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE po_confirmation_requests SET status = 'superseded', updated_at = ? WHERE id = ?`,
    [now, requestId]
  );
  console.error('[po-confirmation-service] submission permanently rejected (RLS) — marked superseded:', reason);
}

export type SubmitPoConfirmationResult = 'submitted' | 'skipped_not_draft' | 'offline' | 'failed' | 'superseded';

/** B-088: the meeting a request references may still be mid-push (`meetings.sync_status` set by push-batch.ts's `recordSynced()`) — same check the entity registry's `isBlockedByDependency` does for outbox rows, applied here since `po_confirmation_requests` isn't itself outbox-queued (ADR-044 decision 5). */
async function isMeetingSynced(db: SQLiteDatabase, meetingId: string): Promise<boolean> {
  const meeting = await db.getFirstAsync<{ sync_status: string }>(
    'SELECT sync_status FROM meetings WHERE id = ?',
    [meetingId]
  );
  return meeting?.sync_status === 'synced';
}

/**
 * Same class of race as `isMeetingSynced()`, for the OTHER foreign
 * reference the "Agents create own PO confirmation" INSERT policy checks
 * (Migration-039-Report.md): `with check (... and exists (select 1 from
 * clients c where c.id = client_id and c.assigned_agent_id =
 * current_profile_id()))`. A client that hasn't pushed to Supabase yet
 * (e.g. created and closed in the same session, still `sync_status =
 * 'pending'` in the local outbox) makes that `exists(...)` false — Postgres
 * reports this identically to a real ownership mismatch: "new row violates
 * row-level security policy", no distinguishing detail. Deferring here
 * (same as B-088) turns a false-permanent failure into a retry once the
 * client itself has landed.
 */
async function isClientSynced(db: SQLiteDatabase, clientId: string): Promise<boolean> {
  const client = await db.getFirstAsync<{ sync_status: string }>(
    'SELECT sync_status FROM clients WHERE id = ?',
    [clientId]
  );
  return client?.sync_status === 'synced';
}

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

  // B-088: attempting the insert before the meeting itself lands in
  // Supabase violates po_confirmation_requests_meeting_id_fkey — defer
  // instead of crashing; the row stays 'draft' for a later retry.
  if (!(await isMeetingSynced(db, row.meeting_id)) || !(await isClientSynced(db, row.client_id))) {
    return 'offline';
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
    // 23505 on this specific row's id means a PRIOR submitPoConfirmation
    // attempt already got the INSERT through, but this row's local status
    // update below never completed (e.g. app killed mid-retry) — so the
    // local row was stuck 'draft' even though the server already has it.
    // The duplicate IS the already-submitted state, not a new failure:
    // without this check, every future retry (retryDraftPoConfirmations
    // runs on every Notifications load) would re-attempt the same insert
    // and fail the same way forever. Plain `.insert()` kept deliberately
    // (not `.upsert()`) — matches lib/sync/remote-upsert.ts's documented
    // finding that `.upsert(..., {ignoreDuplicates})` hits a PostgREST/RLS
    // 42501 quirk on this project's Supabase project for insert-only RLS
    // policies like this table's.
    //
    // 42501 (RLS_PERMISSION_DENIED_CODE) means the "Agents create own PO
    // confirmation" policy's `with check` failed — either requester_id
    // doesn't match the live session, or (far more likely given the
    // ownership join in that policy) `row.client_id` is no longer assigned
    // to this requester server-side (reassigned, deleted, stale test data).
    // This is NEVER transient like the isMeetingSynced/isClientSynced
    // guards above — retrying an unchanged payload against an unchanged
    // policy produces the same rejection forever. Mark the row terminal
    // (2026-08-04, SQLite v24 `'superseded'`) so retryDraftPoConfirmations()
    // stops resubmitting it on every Notifications-screen visit.
    if (error && error.code === RLS_PERMISSION_DENIED_CODE) {
      await markPoConfirmationSuperseded(db, requestId, error.message);
      return 'superseded';
    }
    if (error && error.code !== UNIQUE_VIOLATION_CODE) throw error;

    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE po_confirmation_requests
         SET status = 'pending', po_photo_path = ?, updated_at = ?, synced_at = ?
       WHERE id = ?`,
      [publicUrl, now, now, requestId]
    );
    return 'submitted';
  } catch (err) {
    const details =
      err instanceof Error
        ? err.message
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();
    // B-095 follow-up: catches the Storage-upload RLS case that used to fall
    // through here silently as a generic 'failed' — see
    // isRlsPermissionDenied()'s doc comment. Anything else (network blip,
    // timeout, transient Storage error) still returns 'failed' as before,
    // leaving the row 'draft' for a legitimate retry.
    if (isRlsPermissionDenied(err)) {
      await markPoConfirmationSuperseded(db, requestId, details);
      return 'superseded';
    }
    console.error('[po-confirmation-service] submission failed:', details);
    return 'failed';
  }
}

interface PendingPoConfirmationClientRow {
  client_id: string;
}

/**
 * Vince 2026-08-04 direction: batch-loads which of the requester's own
 * `in_progress` clients currently have a `'pending'` (submitted, not yet
 * decided by a Manager) PO confirmation request — the mobile-side "Waiting
 * for Manager's Approval" overlay badge on My Clients / Client Detail.
 * `'draft'` (captured but never submitted, ADR-044 decision 5) is
 * deliberately excluded — a draft hasn't reached a Manager yet, so it isn't
 * "waiting" on one. Joins against `clients.status` here (rather than
 * trusting the caller to re-check it) so a client that already left
 * `in_progress` never shows the badge even if a stale `pending` row still
 * exists locally. Batched (one query for the whole list), mirroring
 * `lib/tag-along-service.ts#getClientIdsWithPendingManagerTagAlong`'s same
 * N+1-avoidance pattern.
 */
export async function getClientIdsWithPendingPoConfirmation(requesterId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<PendingPoConfirmationClientRow>(
    `SELECT DISTINCT p.client_id as client_id
       FROM po_confirmation_requests p
       JOIN clients c ON c.id = p.client_id
      WHERE p.requester_id = ?
        AND p.status = 'pending'
        AND c.status = 'in_progress'`,
    [requesterId]
  );
  return new Set(rows.map((row) => row.client_id));
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
 * B-091: submitPoConfirmation()'s isMeetingSynced() guard can leave a row
 * stuck 'draft' forever if the meeting hadn't reached Supabase yet at
 * capture time — this is the "later via a retry affordance once online"
 * call site capturePoEvidenceLocally()'s own docstring already promises.
 * Resolves the real Auth uid fresh (not `requesterId`, which is the
 * profileId) since Storage RLS keys off `auth.uid()`, same split as
 * meeting-record-assembler.ts's `authUserId` vs `agent_id`. Never throws —
 * a failed retry just leaves the row 'draft' for the next call.
 */
async function retryDraftPoConfirmations(db: SQLiteDatabase, requesterId: string): Promise<void> {
  const drafts = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM po_confirmation_requests WHERE requester_id = ? AND status = 'draft'",
    [requesterId]
  );
  if (drafts.length === 0) return;

  const { data } = await supabase.auth.getSession();
  const authUid = data.session?.user.id;
  if (!authUid) return;

  for (const { id } of drafts) {
    await submitPoConfirmation(db, id, authUid);
  }
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

  try {
    await retryDraftPoConfirmations(db, requesterId);
  } catch (err) {
    console.error('[po-confirmation-service] draft retry failed:', err instanceof Error ? err.message : String(err));
  }

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
