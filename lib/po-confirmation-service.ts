import { File } from 'expo-file-system';
import { getDb } from './db';
import { uuidv4 } from './uuid';
import { supabase } from './supabase';
import { rawSupabaseRestInsert } from './supabase-raw-probe';
import { isLikelyOnline } from './sync/connectivity';
import { enqueueOutboxRow } from './sync/entity-registry';
import { enqueuePendingUpload, ensurePoPhotoQueued } from './sync/photo-uploads';
import { buildPhotoStoragePath } from './sync/photo-upload-registry';
import { withTimeout } from './with-timeout';
import { MEETING_PHOTO_BUCKET, PHOTO_UPLOAD_TIMEOUT_MS } from './meeting-photo-service';
import { RLS_PERMISSION_DENIED_CODE, UNIQUE_VIOLATION_CODE } from './sync/outbox-status';
import {
  canAttemptSubmission,
  derivePoConfirmationDisplayStatus,
  derivePoConfirmationSlotState,
  LOCAL_ONLY_PO_CONFIRMATION_STATUSES,
  PO_CONFIRMATION_REQUEST_KIND,
  type LocalPoConfirmationStatus,
  type PoConfirmationDisplayStatus,
  type PoConfirmationSlotState,
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
  const existing = await db.getAllAsync<{ id: string; status: LocalPoConfirmationStatus }>(
    `SELECT id, status FROM po_confirmation_requests WHERE client_id = ? AND cycle_id = ? ORDER BY created_at DESC`,
    [input.clientId, input.cycleId],
  );
  // B-125 (Vince, 2026-08-20): only a SERVER-confirmed row reserves the
  // client/cycle slot. Local-only evidence (draft / duplicate_blocked /
  // superseded) never reached Supabase, so it holds no real reservation —
  // it is replaced by this newer capture instead of blocking it forever.
  // Previously any `draft` blocked, which meant a single failed submission
  // permanently locked the agent out of filing a PO for that client.
  const slotState = derivePoConfirmationSlotState(existing.map((row) => row.status));
  const blocked = slotState === 'server_confirmed';
  if (slotState === 'replaceable_local') {
    // Retire the stale local rows rather than deleting them: the photo path
    // stays on the device for support/audit, and 'superseded' is already the
    // established local-only terminal state for evidence that can never be
    // sent (isTerminalPoConfirmationFailure). Scoped to local-only statuses
    // so a concurrently-arrived server row can never be clobbered here.
    for (const row of existing) {
      if (!LOCAL_ONLY_PO_CONFIRMATION_STATUSES.has(row.status)) continue;
      await db.runAsync(
        `UPDATE po_confirmation_requests SET status = 'superseded', decision_note = ?, updated_at = ? WHERE id = ?`,
        ['Replaced by newer PO evidence for the same client cycle.', now, row.id],
      );
    }
  }
  await db.runAsync(
    `INSERT INTO po_confirmation_requests
      (id, client_id, cycle_id, meeting_id, requester_id, po_photo_path, status, created_at, updated_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [id, input.clientId, input.cycleId, input.meetingId, input.requesterId, input.localPhotoUri,
      blocked ? 'duplicate_blocked' : 'draft', now, now]
  );
  if (blocked) {
    await db.runAsync(
      `UPDATE po_confirmation_requests SET decision_note = ? WHERE id = ?`,
      ['A current or approved PO confirmation already exists for this client cycle.', id],
    );
  }
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

    const row = await db.getFirstAsync<{ status: LocalPoConfirmationStatus }>(
      'SELECT status FROM po_confirmation_requests WHERE id = ?',
      [requestId]
    );
    // A duplicate_blocked capture is deliberate local-only evidence — it must
    // never be pushed, or it would race the row that legitimately holds the
    // client/cycle slot (B-125).
    if (row?.status !== 'draft') return;

    await enqueuePoConfirmationForSync(db, requestId, input);
  } catch (err) {
    console.error(
      '[po-confirmation-service] capture-and-queue failed:',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    );
  }
}

/**
 * B-127 (Vince, 2026-08-20): queues the PO through the normal offline-first
 * lane instead of the old online-only direct insert.
 *
 * ADR-044 decision 5 made every approval action online-only, but lumped
 * request CREATION in with manager DECISIONS. Only the decision half needed
 * it (that genuinely requires the server's compare-and-set to stay race-safe
 * — `decide_po_confirmation()` is unchanged). Creation is field work captured
 * mid-meeting, exactly where signal is worst, and making it online-only broke
 * rule 1 of this app: all writes go to SQLite first, the sync layer uploads.
 *
 * What this replaces, and why each piece is now redundant:
 *  - the manual `pushOutboxOnly()` + 1500ms sleep + `sync_status` re-check
 *    that hand-rolled the meeting-FK ordering (B-088/B-091) — the registry's
 *    `dependencies` on `clients` + `meetings` does that correctly;
 *  - the "leave it 'draft' and hope a Notifications visit retries it" path —
 *    the outbox retries on its own schedule;
 *  - the inline Storage upload with no retry (B-098) — the photo now goes
 *    through `pending_uploads` and self-patches `po_photo_path`, the same
 *    lane a meeting selfie already uses.
 *
 * The row pushes with the LOCAL file path in `po_photo_path` and is patched
 * with the public URL once the photo upload lands — identical to how a
 * meeting pushes with a local `file://` selfie_url. It also becomes visible
 * in Sync Center/History for free, which is what Vince expected all along.
 */
async function enqueuePoConfirmationForSync(
  db: SQLiteDatabase,
  requestId: string,
  input: CaptureAndSubmitPoEvidenceInput
): Promise<void> {
  const now = new Date().toISOString();
  const createdOnline = await isLikelyOnline();

  await enqueueOutboxRow(db, {
    outboxId: uuidv4(),
    recordId: requestId,
    tableName: 'po_confirmation_requests',
    operation: 'insert',
    payload: JSON.stringify({
      id: requestId,
      client_id: input.clientId,
      cycle_id: input.cycleId,
      meeting_id: input.meetingId,
      requester_id: input.requesterId,
      // B-127: the FINAL public URL, not the local file:// path. The storage
      // path is deterministic and `getPublicUrl()` is a pure string builder
      // (no network), so the correct URL is knowable offline at capture time.
      // This is what lets PO skip the post-upload URL patch entirely — which
      // migration 039's RLS makes impossible anyway (its only UPDATE policy
      // is `with check (status = 'cancelled')`, so any patch that leaves the
      // row pending is refused 42501). The URL 404s only until the queued
      // upload lands.
      po_photo_path: buildPoEvidencePublicUrl(input.userId, requestId),
      status: 'pending',
      created_at: now,
      updated_at: now,
    }),
    createdAt: now,
    createdOnline,
  });

  // Local status moves to 'pending' the moment it is queued: from the agent's
  // point of view it is now genuinely awaiting a manager, not sitting
  // un-sent. 'draft' from here on means only "captured but not yet queued".
  // Local row mirrors what was pushed, so the meeting-detail PO card and My
  // Requests show the same URL the manager sees. The device keeps rendering
  // fine either way — the local file is still on disk until the OS clears
  // the cache — but they must not disagree about what was submitted.
  await db.runAsync(
    `UPDATE po_confirmation_requests SET status = 'pending', po_photo_path = ?, updated_at = ? WHERE id = ? AND status = 'draft'`,
    [buildPoEvidencePublicUrl(input.userId, requestId), now, requestId]
  );

  await queuePoPhotoUpload(db, requestId, input);
}

/**
 * The PO row pushes with a local `file://` path in `po_photo_path`; this
 * queues the upload that replaces it with the public URL. If it never runs,
 * the request still reaches the manager but points at a path only the
 * capturing device can read — so a failure here is worth one retry rather
 * than a single best-effort attempt.
 *
 * One retry, because the failure actually seen on-device was transient
 * SQLite contention (`NativeStatement.finalizeAsync` rejected) from a sync
 * pass running concurrently, not a bad payload. `ensurePoPhotoQueued()` is
 * the durable backstop for anything that still slips through.
 */
/** The public URL the queued upload will eventually serve, computed offline from the deterministic storage path. */
function buildPoEvidencePublicUrl(authUserId: string, requestId: string): string {
  const storagePath = buildPhotoStoragePath('po_confirmation_requests', authUserId, requestId, 'po_evidence');
  return supabase.storage.from(MEETING_PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function queuePoPhotoUpload(
  db: SQLiteDatabase,
  requestId: string,
  input: CaptureAndSubmitPoEvidenceInput
): Promise<void> {
  try {
    // Wrapped in withTransactionAsync so it goes through `getDb()`'s
    // `serializeTransactions()` queue. Bare `runAsync` here raced whatever
    // sync pass was already in flight on the app's single native connection,
    // and expo-sqlite rejected it with `NativeStatement.finalizeAsync has
    // been rejected` — which is exactly how the PO photo silently failed to
    // queue while the request itself went through.
    await db.withTransactionAsync(async () => {
      await enqueuePendingUpload(db, {
        parentTable: 'po_confirmation_requests',
        parentId: requestId,
        agentId: input.requesterId,
        kind: 'po_evidence',
        localUri: input.localPhotoUri,
        storagePath: buildPhotoStoragePath('po_confirmation_requests', input.userId, requestId, 'po_evidence'),
      });
    });
  } catch (err) {
    // The request itself is already durably queued — a photo-queue failure
    // must never undo it (same best-effort contract as meeting-service.ts's
    // own photoToQueue block). `ensurePoPhotoQueued()` re-queues it on the
    // next sync pass, so this is recoverable rather than lost.
    console.error('[po-confirmation-service] PO photo queue failed; sync will retry:', err instanceof Error ? err.message : String(err));
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
 * RLS_PERMISSION_DENIED_CODE`) and classified the row as permanently
 * rejected. Because B-098 now has evidence of a device transport anomaly,
 * both table and Storage RLS failures remain retryable (`'draft'`) until a
 * release build proves a genuine ownership failure.
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

/**
 * 2026-08-09 (Vince: PO submission still failing after the B-098 logging
 * fix landed — "may error pa din"): the previous log line only printed
 * `error.message`, which is always the same generic Postgres text ("new row
 * violates row-level security policy") no matter WHICH of the with-check's
 * two conditions failed (`requester_id = current_profile_id()` vs the
 * `client_id` ownership `exists(...)`), or whether it's the table insert or
 * the Storage upload. `PostgrestError` also carries `.code`/`.details`/
 * `.hint` (its own doc comment: "Always log the full object... logging only
 * error.message hides the hint") — none of that ever reached the console.
 *
 * A first reproduction (requester_id=9516ba01-…, live auth.uid()=11e69449-…)
 * ruled out a stale cached `profileId`: Vince confirmed a full logout/login
 * cycle (which re-derives `profileId` fresh from `profiles.select('id')
 * .eq('user_id', userId)`, `app/(auth)/login.tsx`) still hits the same
 * rejection — so `requester_id = current_profile_id()` is very likely fine.
 * That leaves the OTHER with-check condition: `clients.assigned_agent_id =
 * current_profile_id()` for this specific `client_id`. Given ADR-051's
 * explicit "no SQLite wipe on logout/suspension" and this device's
 * documented history of switching between multiple test accounts (see
 * Bugs.md B-080's verification note), the leading theory is that the local
 * `clients` row being used here is stale data left over from a DIFFERENT
 * test account's session — its `assigned_agent_id` server-side may not
 * belong to whoever is logged in now. This now does a live, RLS-gated read
 * of the client's real `assigned_agent_id` right at the failure point (same
 * "Agents read own clients" policy the with-check's `exists()` uses) to
 * confirm or rule this out directly in the log, instead of guessing again.
 */
function describeRlsRejection(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = err.code;
    if (typeof code === 'string') {
      return `code=${code} reason=permission denied by remote policy or request transport`;
    }
  }
  return 'code=unknown reason=permission denied by remote policy or request transport';
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

type SubmissionAttemptResult =
  | { kind: 'submitted'; publicUrl: string }
  | { kind: 'rls_rejected'; err: unknown }
  | { kind: 'duplicate_conflict'; err: unknown }
  | { kind: 'other_error'; err: unknown };

async function remoteRequestExists(requestId: string): Promise<boolean> {
  const { data, error } = await supabase.from('po_confirmation_requests').select('id').eq('id', requestId).maybeSingle();
  return !error && data?.id === requestId;
}

/**
 * B-125: the Save-time preflight for a new PO capture. Returns WHICH kind of
 * occupancy the client/cycle slot has, so the UI can tell a genuine
 * server-side reservation ('server_confirmed' — still blocked) apart from
 * stale local-only evidence ('replaceable_local' — warn, then overwrite).
 * Replaces the old boolean, which conflated the two and let one failed
 * submission lock an agent out of that client's PO permanently.
 */
export async function getPoEvidenceSlotState(
  db: SQLiteDatabase,
  clientId: string,
  cycleId: string
): Promise<PoConfirmationSlotState> {
  const rows = await db.getAllAsync<{ status: LocalPoConfirmationStatus }>('SELECT status FROM po_confirmation_requests WHERE client_id = ? AND cycle_id = ? ORDER BY created_at DESC', [clientId, cycleId]);
  return derivePoConfirmationSlotState(rows.map((row) => row.status));
}

/**
 * One attempt: upload the photo, then INSERT. Classifies the outcome but
 * never throws — the caller decides whether to retry.
 *
 * 2026-08-09 (Bugs.md B-098): the INSERT goes through `rawSupabaseRestInsert`
 * (a direct PostgREST POST with manually-attached headers) instead of
 * `supabase.from('po_confirmation_requests').insert()`. A live-device
 * reproduction proved the SDK call was getting RLS-rejected while the same
 * token and payload succeed in an off-device curl request. The data, policy,
 * and token were independently verified correct (direct-SQL reproduction and
 * decoded JWT claims), so this bypass isolates the transport path. Release
 * build/device verification remains required before closing B-098.
 */
async function attemptSubmission(row: LocalPoConfirmationRow, userId: string, requestId: string): Promise<SubmissionAttemptResult> {
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
    const result = await rawSupabaseRestInsert('po_confirmation_requests', remotePayload);
    // 23505 on this row's own id means a prior attempt's INSERT already
    // landed server-side (see submitPoConfirmation's doc comment) — that is
    // the expected, self-healing "already submitted" case, not a failure, so
    // it must not log as one before falling through to `submitted` below.
    if (!result.ok && result.code !== UNIQUE_VIOLATION_CODE) {
      console.error(
        `[po-confirmation-service] rawSupabaseRestInsert failed: status=${result.status} code=${result.code ?? 'unknown'}`
      );
      if (result.code === RLS_PERMISSION_DENIED_CODE) return { kind: 'rls_rejected', err: result };
      return { kind: 'other_error', err: result };
    }
    if (!result.ok && result.code === UNIQUE_VIOLATION_CODE) {
      if (await remoteRequestExists(requestId)) return { kind: 'submitted', publicUrl };
      return { kind: 'duplicate_conflict', err: result };
    }
    return { kind: 'submitted', publicUrl };
  } catch (err) {
    if (isRlsPermissionDenied(err)) return { kind: 'rls_rejected', err };
    return { kind: 'other_error', err };
  }
}

/**
 * Step 2 (online-only, ADR-044 decision 5): uploads the captured photo, then
 * a direct RLS-gated INSERT into `po_confirmation_requests` (no dedicated
 * create-RPC exists — Migration-039-Report.md's "Agents create own PO
 * confirmation" policy is a plain INSERT policy). Never throws — a failure
 * leaves the local row `'draft'` so the UI can retry later; this must never
 * be allowed to undo or block the already-saved meeting it's attached to.
 *
 * 2026-08-09 (Vince: PO submission repeatedly RLS-rejected with correct
 * ownership data): a live-DB reproduction proved the "Agents create own PO
 * confirmation" policy and the underlying data are BOTH correct — inserting
 * the exact same row as the real authenticated user (matching JWT `sub`)
 * succeeded, while the identical insert as `anon` (no JWT) failed with the
 * exact same "new row violates row-level security policy" message this app
 * was seeing. This proves the rejection is a TRANSPORT-level issue: the
 * request landed without a valid Authorization token, not a data/policy
 * problem — plausible given this call fires immediately after two
 * back-to-back `runSync()` passes (`meeting-po-evidence-submission.ts`,
 * heavy concurrent Supabase call volume right after meeting save), a window
 * where a supabase-js token-refresh race is plausible. 23505 on this row's
 * own id (not the RLS check below) means a prior attempt already got the
 * INSERT through server-side but the local status update never landed (app
 * killed mid-retry) — the duplicate IS the already-submitted state, not a
 * new failure. Plain `.insert()` kept deliberately (not `.upsert()`) —
 * matches lib/sync/remote-upsert.ts's documented 42501/PostgREST quirk with
 * `.upsert(..., {ignoreDuplicates})` on insert-only RLS policies like this
 * table's.
 */
/**
 * B-120 (2026-08-20): records WHY a still-'draft' row did not reach the
 * server, without changing its status — the row stays 'draft' and stays
 * retryable, exactly as before. Purely additive diagnostics: every path that
 * used to return silently now leaves a plain-language reason the agent can
 * read on the Notifications PO card, instead of the meeting appearing to
 * save perfectly while nothing arrives in the manager's approvals inbox.
 */
async function recordDeferralReason(db: SQLiteDatabase, requestId: string, reason: string): Promise<void> {
  try {
    await db.runAsync(
      `UPDATE po_confirmation_requests SET decision_note = ?, updated_at = ? WHERE id = ? AND status = 'draft'`,
      [reason, new Date().toISOString(), requestId]
    );
  } catch (err) {
    // Diagnostics must never break the submission path they describe.
    console.error('[po-confirmation-service] could not record deferral reason:', err instanceof Error ? err.message : String(err));
  }
}

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
    if (row.status === 'draft') {
      await recordDeferralReason(db, requestId, 'No connection when this was saved. It will send automatically once you are online.');
      return 'offline';
    }
    return 'skipped_not_draft';
  }

  // B-088: attempting the insert before the meeting itself lands in
  // Supabase violates po_confirmation_requests_meeting_id_fkey — defer
  // instead of crashing; the row stays 'draft' for a later retry.
  //
  // B-120 diagnosis aid (2026-08-20): these two guards are the most common
  // reason a PO silently never reaches the manager, and until now they
  // returned 'offline' leaving NO trace of which one fired — the agent saw a
  // successful meeting save and an empty approvals inbox with nothing to
  // explain it. The reason is now written onto the row so the PO card in
  // Notifications can state it, and so a support/diagnosis pass can tell the
  // two apart without a device log.
  if (!(await isMeetingSynced(db, row.meeting_id))) {
    await recordDeferralReason(db, requestId, 'Waiting for this meeting to finish uploading before the purchase order can be sent.');
    return 'offline';
  }
  if (!(await isClientSynced(db, row.client_id))) {
    await recordDeferralReason(db, requestId, 'Waiting for this client record to finish uploading before the purchase order can be sent.');
    return 'offline';
  }

  let result = await attemptSubmission(row, userId, requestId);

  // A single retry after an EXPLICIT session refresh — not a blind retry of
  // an unchanged payload against an unchanged policy (that really would loop
  // forever), but a targeted response to the proven transport-auth theory
  // above. If the token genuinely was stale/mid-refresh, a fresh one gives
  // the retried request a real chance; if ownership is genuinely wrong, this
  // second attempt fails identically and is left retryable below.
  if (result.kind === 'rls_rejected') {
    try {
      await supabase.auth.refreshSession();
    } catch (refreshErr) {
      console.error(
        '[po-confirmation-service] session refresh before RLS retry failed:',
        refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
      );
    }
    result = await attemptSubmission(row, userId, requestId);
  }

  if (result.kind === 'rls_rejected') {
    const reason = describeRlsRejection(result.err);
    // B-098: the server accepts this exact token/payload from curl while the
    // device POST is rejected. Keep the evidence retryable until a release
    // build proves this is a genuine ownership/policy failure; do not destroy
    // the only local copy by marking it permanently superseded.
    console.error('[po-confirmation-service] submission rejected (RLS/transport); leaving local evidence draft for retry:', `${reason} | retried after session refresh`);
    await recordDeferralReason(db, requestId, 'The server refused this purchase order upload. It is saved on this phone and will retry — report this if it keeps happening.');
    return 'failed';
  }

  if (result.kind === 'other_error') {
    let details = 'request failed';
    if (result.err && typeof result.err === 'object' && 'status' in result.err) {
      const status = typeof result.err.status === 'number' ? result.err.status : 'unknown';
      const code = 'code' in result.err && typeof result.err.code === 'string' ? result.err.code : 'unknown';
      details = `status=${status} code=${code}`;
    }
    console.error('[po-confirmation-service] submission failed:', details);
    await recordDeferralReason(db, requestId, `The purchase order upload did not go through (${details}). It is saved on this phone and will retry.`);
    return 'failed';
  }

  if (result.kind === 'duplicate_conflict') {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE po_confirmation_requests SET status = 'duplicate_blocked', decision_note = ?, updated_at = ? WHERE id = ?`,
      ['A different active PO confirmation already exists for this client cycle; this evidence was kept on this device.', now, requestId],
    );
    return 'failed';
  }

  const now = new Date().toISOString();
  // `decision_note` is cleared here on purpose: a row that deferred once
  // (recordDeferralReason above) and then succeeded on a later retry must not
  // keep displaying the old "did not go through" text next to a successfully
  // submitted PO. The manager's real decision note, when one arrives, comes
  // from the server via getMyPoConfirmationStatuses()'s reconciliation.
  await db.runAsync(
    `UPDATE po_confirmation_requests
       SET status = 'pending', po_photo_path = ?, updated_at = ?, synced_at = ?, decision_note = NULL
     WHERE id = ?`,
    [result.publicUrl, now, now, requestId]
  );
  return 'submitted';
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

/**
 * ADR-061 (Vince, 2026-08-19/20): the same lookup as
 * `getClientIdsWithPendingPoConfirmation()` above, scoped to `prospect`
 * instead of `in_progress` — Scenario 1's "PO submitted straight from
 * Prospect" case. Deliberately a separate function rather than a
 * status-parameterized one: the caller needs to distinguish the two (they
 * render different badges — `WAITING_MANAGER_PO_APPROVAL_PROSPECT_BADGE` vs
 * `WAITING_MANAGER_PO_APPROVAL_BADGE` in `lib/client-status.ts`), and this
 * keeps that distinction explicit at every call site instead of encoded in a
 * status argument that's easy to pass wrong.
 */
export async function getClientIdsWithPendingProspectPoConfirmation(requesterId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<PendingPoConfirmationClientRow>(
    `SELECT DISTINCT p.client_id as client_id
       FROM po_confirmation_requests p
       JOIN clients c ON c.id = p.client_id
      WHERE p.requester_id = ?
        AND p.status = 'pending'
        AND c.status = 'prospect'`,
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

  // B-127: re-queue any PO photo stranded by a failed capture-time
  // enqueue. Deliberately here and NOT inside runSync()'s pass: this is a
  // quiet, UI-triggered moment on the app's single native SQLite
  // connection, the same slot the old draft-retry already used safely.
  // Attempting it mid-sync had expo-sqlite reject the statement with
  // `NativeStatement.finalizeAsync has been rejected`, even wrapped in a
  // transaction.
  try {
    const { data } = await supabase.auth.getSession();
    const authUid = data.session?.user.id;
    if (authUid) await ensurePoPhotoQueued(db, requesterId, authUid);
  } catch (err) {
    console.error('[po-confirmation-service] PO photo re-queue skipped:', err instanceof Error ? err.message : String(err));
  }

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
