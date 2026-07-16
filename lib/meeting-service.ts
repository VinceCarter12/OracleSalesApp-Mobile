import { File } from 'expo-file-system';
import { supabase } from './supabase';
import { getDb } from './db';
import { uuidv4 } from './uuid';
import { runSync } from './sync-engine';
import { enqueueOutboxRow } from './sync/entity-registry';
import type { MeetingMode, MeetingOutcome } from '../types';
import type { RemoteMeetingOutcome } from '../types/database';

const MEETING_PHOTO_BUCKET = 'meeting-photos';

// Remote CHECK constraints confirmed 2026-07-16 via `pg_constraint` (see
// Bugs.md B-012) — mobile's own labels never matched these, same class of
// gap as B-011's column-name mismatch, just at the value level instead.
// `meetings_meeting_type_check`: ('f2f', 'online')
// `meetings_location_type_check`: ('client_office', 'other')
// `meetings_outcome_check`: ('successful', 'follow_up', 'no_decision', 'lost_opportunity')
// `meetings_online_platform_check`: ('zoom', 'googlemeet') — not sent yet, no mobile UI collects it

function toRemoteMeetingType(mode: MeetingMode): 'f2f' | 'online' {
  return mode === 'online' ? 'online' : 'f2f';
}

function toRemoteLocationType(locationType: string | null | undefined): 'client_office' | 'other' | null {
  if (!locationType) return null;
  return locationType === 'Others' ? 'other' : 'client_office';
}

const OUTCOME_TO_REMOTE: Record<MeetingOutcome, RemoteMeetingOutcome> = {
  Successful: 'successful',
  'Follow-up Required': 'follow_up',
  'No Decision': 'no_decision',
  'Lost Opportunity': 'lost_opportunity',
};

function toRemoteOutcome(outcome: MeetingOutcome | null): RemoteMeetingOutcome | null {
  return outcome ? OUTCOME_TO_REMOTE[outcome] : null;
}

const OUTCOME_FROM_REMOTE: Record<RemoteMeetingOutcome, MeetingOutcome> = {
  successful: 'Successful',
  follow_up: 'Follow-up Required',
  no_decision: 'No Decision',
  lost_opportunity: 'Lost Opportunity',
};

/** Reverse of `toRemoteOutcome` — needed by anything reading meetings straight from Supabase (e.g. the Manager dashboard's cross-agent queries). */
export function fromRemoteOutcome(outcome: string | null): MeetingOutcome | null {
  return outcome && outcome in OUTCOME_FROM_REMOTE ? OUTCOME_FROM_REMOTE[outcome as RemoteMeetingOutcome] : null;
}

/**
 * Uploads a locally captured photo to Supabase Storage and returns its public
 * URL. Reads the file's raw bytes via SDK 57's `File.bytes()` rather than
 * `fetch(uri).then(r => r.blob())` — on Hermes/Android, supabase-storage-js
 * re-reads a RN `Blob` via `FileReader.readAsArrayBuffer` and then tries to
 * construct `new Blob([arrayBuffer])` internally, which RN's Blob polyfill
 * doesn't support ("Creating blobs from 'ArrayBuffer' ... are not
 * supported") — passing bytes directly skips that path entirely.
 *
 * NOTE: `expo-file-system/legacy` (the `readAsStringAsync` API) looked right
 * at first, but its package.json `exports` map points at un-transpiled `.ts`
 * source that Metro can't resolve as an installed dependency (only works
 * inside the expo/expo monorepo itself) — it crashed the bundler entirely.
 * `File` is the real, documented SDK 57 API and needs no subpath import.
 */
export async function uploadMeetingPhoto(
  localUri: string,
  userId: string,
  kind: 'selfie' | 'start' | 'end'
): Promise<string> {
  const ext = localUri.split('.').pop() ?? 'jpg';
  const fileName = `meetings/${userId}/${Date.now()}-${kind}.${ext}`;
  const bytes = await new File(localUri).bytes();
  const { error } = await supabase.storage
    .from(MEETING_PHOTO_BUCKET)
    .upload(fileName, bytes, { contentType: `image/${ext}` });
  if (error) throw error;
  const { data } = supabase.storage.from(MEETING_PHOTO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
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
    photo_url: record.selfie_url ?? null,
    // Existing-client fast path no longer captures a start photo (2026-07-16
    // revision) — the column stays for the remote schema shape, just unset.
    start_photo_url: null,
    start_captured_at: record.start_captured_at ?? null,
    end_photo_url: record.end_photo_url ?? null,
    end_captured_at: record.end_captured_at ?? null,
    end_gps_lat: record.end_gps_lat ?? null,
    end_gps_lng: record.end_gps_lng ?? null,
    meeting_date: record.logged_at,
    contact_person: record.contactPerson ?? null,
    contact_position: record.contactPosition ?? null,
    location_type: toRemoteLocationType(record.locationType),
    location_name: record.locationName ?? null,
    remarks: record.remarks ?? null,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO meetings
        (id, client_id, agent_id, gps_lat, gps_lng, selfie_url, agendas, outcome, meeting_mode,
         start_photo_url, start_captured_at, end_photo_url, end_captured_at, end_gps_lat, end_gps_lng,
         logged_at, created_at, sync_status, local_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
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
    });
  });

  // Best-effort immediate push; if offline (or the client hasn't synced yet)
  // this silently no-ops/defers and the outbox row waits for use-sync.ts's
  // reconnect listener + the entity registry's dependency guard.
  runSync(record.agent_id).catch((err) =>
    console.error('[meeting-service] background sync failed:', JSON.stringify(err, null, 2))
  );

  return id;
}
