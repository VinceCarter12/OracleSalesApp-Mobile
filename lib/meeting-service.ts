import { getDb } from './db';
import { uuidv4 } from './uuid';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import { enqueuePendingUpload, type PhotoKind } from './sync/photo-uploads';
import { buildMeetingPhotoStoragePath } from './meeting-photo-service';
import { isLikelyOnline } from './sync/connectivity';
import { insertMeetingCompanionRequests, type CompanionSelection } from './tag-along-service';
import { insertAcceptedMeetingCompanions } from './tag-along-manager-service';
import { computeMeetingValidityStatusOnCreate } from './policies/tag-along-validity-policy';
import { writeOfficePinLocal } from './office-pin-service';
import { getCurrentAgendaCatalog } from './meeting-agenda-catalog-source';
import { mapAgendaLabelsToIds } from './policies/agenda-label-mapping';
import { buildRemoteMeetingPayload } from './remote-meeting-payload';
import { verifyAccountActive, AccountSuspendedError } from './app-lock/account-status';
import { applyLocalLifecyclePrediction } from './local-lifecycle-prediction-service';
import { notifySyncComplete } from './sync/sync-events';
import { submitMeetingPoEvidenceIfPresent } from './meeting-po-evidence-submission';
import type { MeetingMode, MeetingOutcome } from '../types';

// Batch 5 Slice 2 (ADR-051): short budget so a suspension check never
// meaningfully delays an offline field write — this must fail open fast.
const SENSITIVE_WRITE_CHECK_TIMEOUT_MS = 2500;

export { buildMeetingPhotoStoragePath, uploadMeetingPhoto, enqueueMeetingPhotoUrlUpdate, MEETING_PHOTO_BUCKET, PHOTO_UPLOAD_TIMEOUT_MS } from './meeting-photo-service';

// Remote CHECK constraints (`meetings_meeting_type_check` /
// `meetings_location_type_check` / `meetings_outcome_check` /
// `meetings_online_platform_check`) are documented + mapped in
// lib/remote-meeting-mapping.ts — not duplicated here.
//
// B-028: `contact_person`/`location_type`/`outcome` are `NOT NULL` remotely,
// but the fast path (record-visit.tsx, ADR-015) never collects outcome or
// location. Fallback defaults (`successful` / `client_office`, a judgment
// call, not confirmed spec) live in lib/remote-meeting-mapping.ts.

export interface NewMeetingRecord {
  client_id: string | null;
  agent_id: string;
  /** Start-of-meeting GPS (existing-client fast path: bound to the Start button tap, no photo — see 2026-07-16 revision). */
  gps_lat: number;
  gps_lng: number;
  meeting_mode: MeetingMode;
  agendas: string[];
  outcome: MeetingOutcome | null;
  selfie_url?: string | null;
  start_captured_at?: string | null;
  end_photo_url?: string | null;
  end_captured_at?: string | null;
  /** End-of-meeting GPS, captured at the end photo's shutter press — kept separate from start GPS so admin (web) can manually validate the two match. */
  end_gps_lat?: number | null;
  end_gps_lng?: number | null;
  logged_at: string;
  contactPerson?: string | null;
  contactPosition?: string | null;
  /** 'Client Office' / 'Others' (Wireframe meeting-location picker) — maps to remote `location_type`. */
  locationType?: string | null;
  /** Free text only used when locationType is 'Others' — maps to remote `location_name`. */
  locationName?: string | null;
  remarks?: string | null;
  /**
   * Phase C (ADR-026 P1 item 4): when the screen just captured a photo,
   * `createMeeting()` queues its upload internally right after the local
   * insert commits — the single call site both recording screens now share,
   * instead of each screen duplicating "insert, then enqueue" itself.
   * `userId` is the Auth uid (Storage RLS keys off `auth.uid()`, never
   * `profileId` — same split as the old `uploadMeetingPhoto()` call sites).
   */
  photoToQueue?: {
    kind: PhotoKind;
    localUri: string;
    userId: string;
  } | null;
  /** ADR-030 Pass 2.5: 0–2 companions picked in Record Meeting's "Kasama sa visit" section — optional/omittable, never gates the save. */
  companions?: CompanionSelection[];
  /**
   * F-205 decision 2: true when the requester (`agent_id`) is a manager
   * recording their own meeting — the companion rows insert pre-accepted
   * (`insertAcceptedMeetingCompanions`) instead of pending
   * (`insertMeetingCompanionRequests`), since there's no counterpart to
   * approve a manager's own request. Omit/false for the normal agent path.
   */
  companionsPreAccepted?: boolean;
  /** ADR-044/046 point 7 (Batch 3, Slice 5): PO evidence for an In Progress client's 'Close deal' agenda. `cycleId` is `Client.cycle_id` (required NOT NULL by `po_confirmation_requests`); `userId` is the Auth uid, same split as `photoToQueue.userId`. Omitted when not applicable. */
  poEvidence?: { localPhotoUri: string; cycleId: string; userId: string } | null;
  /** Batch 4: true only for a 'Client Office' in-person meeting ([[Office-Location-Spec-2026-07-29]]). A boolean, not coordinates — the office pin comes only from THIS meeting's own start GPS above, never a second capture. Online/Others must never set this true. */
  captureOfficePin?: boolean;
}

/**
 * Local-first meeting creation (T-004, ADR-001/002/004) — same pattern as
 * `lib/client-service.ts::createClient()`: one SQLite transaction for the
 * `meetings` insert + its `outbox` row, then a best-effort immediate sync.
 *
 * This used to be a direct, synchronous Supabase insert — which meant a
 * meeting for a just-created client (meeting-first / prospect flow) almost
 * always hit `meetings_client_id_fkey` ("Key is not present in table
 * clients"), since the client's own outbox push hadn't had time to complete
 * yet (see Bugs.md B-013). The entity registry's dependency guard
 * (`isBlockedByDependency`, lib/sync/entity-registry.ts — generalized from
 * the original `isBlockedByPendingClient` in T-014) exists specifically for
 * this ordering problem — it just never got used because meetings never
 * went through the outbox before now.
 *
 * Mobile's own field names also don't match the live Supabase `meetings`
 * columns 1:1 (confirmed via `information_schema.columns`, 2026-07-16 — see
 * Bugs.md B-011/B-012) — same class of gap as clients' `lib/remote-client-mapping.ts`
 * (ADR-018). The remote-shaped payload built below is what actually gets
 * pushed by the outbox; the local SQLite row keeps mobile's own field names
 * (agendas, meeting_mode, selfie_url, logged_at), same split as clients.
 */
export async function createMeeting(record: NewMeetingRecord): Promise<string> {
  // Batch 5 Slice 2 (ADR-051) trigger point 2: fail-open on 'active'/
  // 'unverified' (offline agents must keep working); only a confirmed
  // 'suspended' blocks the write, via a typed error the calling UI must
  // catch and route to AccountSuspendedScreen.
  const accountStatus = await verifyAccountActive(record.agent_id, SENSITIVE_WRITE_CHECK_TIMEOUT_MS);
  if (accountStatus === 'suspended') {
    throw new AccountSuspendedError();
  }

  const db = await getDb();
  const id = uuidv4();
  const outboxId = uuidv4();
  const now = new Date().toISOString();

  // B-083 fix: map the selected display labels to canonical agenda_ids so
  // `advance_prospect_to_in_progress()` (Migration 043) can actually match
  // them — see lib/meeting-agenda-catalog-source.ts for the fallback rule.
  const { catalog: agendaCatalog } = await getCurrentAgendaCatalog(db);
  const agendaIds = mapAgendaLabelsToIds(agendaCatalog, record.agendas);
  const remotePayload = buildRemoteMeetingPayload(id, record, agendaIds);

  const createdOnline = await isLikelyOnline();

  // ADR-046 (correction addendum): decided once, up front, from the same
  // companion selection used below to insert the tag_along_requests rows —
  // never recomputed later on-device (lifecycle/quota gating stays
  // server-reconciled, see lib/tag-along-validity-service.ts).
  const validityStatus = computeMeetingValidityStatusOnCreate(
    record.companions ?? [],
    record.companionsPreAccepted ?? false
  );

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO meetings
        (id, client_id, agent_id, gps_lat, gps_lng, selfie_url, agendas, agenda_ids, outcome, meeting_mode,
         start_photo_url, start_captured_at, end_photo_url, end_captured_at, end_gps_lat, end_gps_lng,
         logged_at, created_at, contact_person, contact_position, location_type, location_name, remarks,
         validity_status, sync_status, local_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id,
        record.client_id,
        record.agent_id,
        record.gps_lat,
        record.gps_lng,
        record.selfie_url ?? null,
        JSON.stringify(record.agendas),
        JSON.stringify(agendaIds),
        record.outcome,
        record.meeting_mode,
        null,
        record.start_captured_at ?? null,
        record.end_photo_url ?? null,
        record.end_captured_at ?? null,
        record.end_gps_lat ?? null,
        record.end_gps_lng ?? null,
        record.logged_at,
        now,
        record.contactPerson?.trim() || null,
        record.contactPosition ?? null,
        record.locationType ?? null,
        record.locationName ?? null,
        record.remarks ?? null,
        validityStatus,
        now,
      ]
    );
    await enqueueOutboxRow(db, {
      outboxId,
      recordId: id,
      tableName: 'meetings',
      operation: 'insert',
      payload: JSON.stringify(remotePayload),
      createdAt: now,
      createdOnline,
    });
    // ADR-030 Pass 2.5: companion requests now created at Record Meeting
    // time (moved from Complete Info) — same transaction as the meeting
    // insert + its outbox row above, so a crash between the two can never
    // strand a companion request without its outbox row, or vice versa.
    if (record.companions?.length && record.client_id) {
      const insertCompanions = record.companionsPreAccepted
        ? insertAcceptedMeetingCompanions
        : insertMeetingCompanionRequests;
      await insertCompanions(db, {
        clientId: record.client_id,
        meetingId: id,
        requesterId: record.agent_id,
        companions: record.companions,
        createdOnline,
      });
    }
    // Batch 4: Client Office meetings auto-capture the office pin from THIS
    // meeting's own start GPS ([[Office-Location-Spec-2026-07-29]]) —
    // local-only, so it stays inside this transaction (unlike the
    // network-I/O poEvidence block below). Reuses the same `db` transaction
    // handle — expo-sqlite can't nest `withTransactionAsync`.
    if (record.captureOfficePin && record.client_id) {
      await writeOfficePinLocal(db, {
        clientId: record.client_id,
        agentId: record.agent_id,
        lat: record.gps_lat,
        lng: record.gps_lng,
        source: 'client_office_meeting',
        capturedAt: record.logged_at,
      });
    }
  });

  // Phase C (ADR-026 P1 item 4): queue the confirmed photo's upload only
  // AFTER the meeting row + its own outbox insert have committed — the
  // upload's eventual remote patch (enqueueMeetingPhotoUrlUpdate) targets
  // this meeting by id, so the meeting must already exist locally first.
  // Best-effort: a queueing failure here must never undo an already-saved
  // meeting (ADR-026 P1's whole point is that the meeting is never lost).
  if (record.photoToQueue) {
    const { kind, localUri, userId } = record.photoToQueue;
    const storagePath = buildMeetingPhotoStoragePath(userId, id, kind);
    try {
      await enqueuePendingUpload(db, {
        parentTable: 'meetings',
        parentId: id,
        agentId: record.agent_id,
        kind,
        localUri,
        storagePath,
      });
    } catch (err) {
      console.error('[meeting-service] failed to queue photo upload:', err instanceof Error ? err.message : String(err));
    }
  }

  // ADR-044 decision 5 / B-088 / B-091: see lib/meeting-po-evidence-submission.ts.
  if (record.poEvidence && record.client_id) {
    await submitMeetingPoEvidenceIfPresent(db, {
      meetingId: id,
      clientId: record.client_id,
      agentId: record.agent_id,
      poEvidence: record.poEvidence,
    });
  }

  // Prospect→new auto-promotion (ADR-027) stays a server-side trigger
  // (ADR-006) — NOT checked on-device; arrives via next sync-down. ADR-006
  // still governs; this is the AUTHORITATIVE promotion path.
  //
  // 2026-08-04 (Vince-approved, scoped ADR-006 exception): a PROVISIONAL
  // local mirror of ONLY prospect->in_progress runs next, for immediate
  // offline display only — never pushed to Supabase, always overwritten by
  // the next sync-down. See lib/policies/local-lifecycle-prediction.ts +
  // lib/local-lifecycle-prediction-service.ts.
  try {
    await applyLocalLifecyclePrediction(db, {
      clientId: record.client_id,
      requesterId: record.agent_id,
      outcome: record.outcome,
      agendaIds,
      agendaCatalog,
      meetingValidityStatus: validityStatus,
    });
  } catch (err) {
    // Best-effort only — a failure here must never affect the already-saved
    // meeting; the real status still arrives via the next sync-down.
    console.error('[meeting-service] local lifecycle prediction failed:', err instanceof Error ? err.message : String(err));
  }

  // Every meeting outcome (not just the promotion above) should be visible
  // immediately on already-mounted screens — reuses the same pub/sub
  // use-sync.ts relies on for this exact purpose.
  notifySyncComplete();

  // Best-effort immediate push; if offline (or the client hasn't synced yet)
  // this silently no-ops/defers and the outbox row waits for use-sync.ts's
  // reconnect listener + the entity registry's dependency guard. A throw
  // here (vs. a per-row failure, which push-batch.ts already classifies and
  // swallows) means the remote upsert itself succeeded but the local
  // bookkeeping UPDATE in recordSynced() failed — self-healing, since
  // recoverStuckSyncingRows() resets the row on next app start and the
  // remote upsert is idempotent. `Error.message` is non-enumerable, so
  // `JSON.stringify(err)` silently dropped it — log it explicitly instead.
  runSync(record.agent_id).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[meeting-service] background sync failed:', message, JSON.stringify(err, null, 2));
  });

  return id;
}
