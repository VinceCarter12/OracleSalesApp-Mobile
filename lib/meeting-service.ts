import { getDb } from './db';
import { uuidv4 } from './uuid';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import { enqueuePendingUpload, type PhotoKind } from './sync/photo-uploads';
import { buildMeetingPhotoStoragePath } from './meeting-photo-service';
import { isLikelyOnline } from './sync/connectivity';
import { toRemoteLocationType, toRemoteMeetingType, toRemoteOutcome } from './remote-meeting-mapping';
import { insertMeetingCompanionRequests, type CompanionSelection } from './tag-along-service';
import type { MeetingMode, MeetingOutcome } from '../types';

export { buildMeetingPhotoStoragePath, uploadMeetingPhoto, enqueueMeetingPhotoUrlUpdate, MEETING_PHOTO_BUCKET, PHOTO_UPLOAD_TIMEOUT_MS } from './meeting-photo-service';

// Remote CHECK constraints confirmed 2026-07-16 via `pg_constraint` (see
// Bugs.md B-012) — mobile's own labels never matched these, same class of
// gap as B-011's column-name mismatch, just at the value level instead.
// `meetings_meeting_type_check`: ('f2f', 'online')
// `meetings_location_type_check`: ('client_office', 'other')
// `meetings_outcome_check`: ('successful', 'follow_up', 'no_decision', 'lost_opportunity')
// `meetings_online_platform_check`: ('zoom', 'googlemeet') — not sent yet, no mobile UI collects it
//
// B-028: `contact_person`, `location_type`, and `outcome` are all `NOT NULL`
// on the live table (confirmed via `supabase/migrations/001_initial.sql` +
// a real device error pulled straight off the local outbox: `null value in
// column "contact_person" ... violates not-null constraint`) — but the
// existing-client fast path (`record-visit.tsx`, ADR-015) deliberately never
// asks for outcome or location (that's the whole point of the fast path),
// and `contact_person` can be left blank in the full form too. Every fast-
// path meeting was silently dead-lettering on every single attempt.
// Defaults below are a judgment call, not a re-derived spec: a completed
// fast-path visit is treated as `successful` (matches ADR-015's own framing
// — there's no "outcome" UI because a routine visit to an existing client
// is assumed fine) and `client_office` (fast-path visits are, by
// definition, a visit to that client). Flag to Vince if either assumption
// is wrong — these are inferred, not confirmed business rules.

/**
 * ADR-026 P1 (interim offline-save fix): a screen falls back to the local
 * `file://` photo URI when `uploadMeetingPhoto()` fails offline, so the
 * meeting is never lost — but that local path is meaningless to Supabase.
 * The remote payload must only ever carry a URL the Storage upload actually
 * produced; anything else (or absent) stays null until Phase C's queued
 * upload retries it.
 */
function remoteMediaUrl(url: string | null | undefined): string | null {
  return url && url.startsWith('http') ? url : null;
}

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
  const db = await getDb();
  const id = uuidv4();
  const outboxId = uuidv4();
  const now = new Date().toISOString();

  const remotePayload = {
    id,
    client_id: record.client_id,
    agent_id: record.agent_id,
    // Tag-along (F-004) and online-meeting (ADR-012) columns — not collected
    // by either mobile flow yet, left null rather than guessed at.
    recorded_by: null,
    online_platform: null,
    gps_lat: record.gps_lat,
    gps_lng: record.gps_lng,
    meeting_type: toRemoteMeetingType(record.meeting_mode),
    agenda: record.agendas,
    outcome: toRemoteOutcome(record.outcome),
    photo_url: remoteMediaUrl(record.selfie_url),
    // Existing-client fast path no longer captures a start photo (2026-07-16
    // revision) — the column stays for the remote schema shape, just unset.
    start_photo_url: null,
    start_captured_at: record.start_captured_at ?? null,
    end_photo_url: remoteMediaUrl(record.end_photo_url),
    end_captured_at: record.end_captured_at ?? null,
    end_gps_lat: record.end_gps_lat ?? null,
    end_gps_lng: record.end_gps_lng ?? null,
    meeting_date: record.logged_at,
    // NOT NULL remotely — empty string, never null (matches clients'
    // established pattern in client-service.ts).
    contact_person: record.contactPerson?.trim() || '',
    contact_position: record.contactPosition ?? null,
    location_type: toRemoteLocationType(record.locationType),
    location_name: record.locationName ?? null,
    remarks: record.remarks ?? null,
  };

  const createdOnline = await isLikelyOnline();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO meetings
        (id, client_id, agent_id, gps_lat, gps_lng, selfie_url, agendas, outcome, meeting_mode,
         start_photo_url, start_captured_at, end_photo_url, end_captured_at, end_gps_lat, end_gps_lng,
         logged_at, created_at, contact_person, contact_position, location_type, location_name, remarks,
         sync_status, local_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id,
        record.client_id,
        record.agent_id,
        record.gps_lat,
        record.gps_lng,
        record.selfie_url ?? null,
        JSON.stringify(record.agendas),
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
      await insertMeetingCompanionRequests(db, {
        clientId: record.client_id,
        meetingId: id,
        requesterId: record.agent_id,
        companions: record.companions,
        createdOnline,
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
        meetingId: id,
        agentId: record.agent_id,
        kind,
        localUri,
        storagePath,
      });
    } catch (err) {
      console.error('[meeting-service] failed to queue photo upload:', err instanceof Error ? err.message : String(err));
    }
  }

  // Prospect→new auto-promotion (ADR-027) is deliberately NOT checked here —
  // it's a server-side Postgres trigger now (ADR-006 requires lifecycle
  // automations to run server-side; see Migration-017-Report.md), fired by
  // this meeting's `outcome` reaching Supabase, not by anything on-device.
  // The resulting `status='new'` arrives back through the normal sync-down
  // pull once the trigger fires remotely.

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
