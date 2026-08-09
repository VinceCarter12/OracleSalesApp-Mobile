import type { CompanionSelection } from './tag-along-service';
import type { NewMeetingRecord } from './meeting-service';
import type { MeetingMode, MeetingOutcome } from '../types';

/**
 * Step B (meeting-recording controller consolidation): both `record.tsx`
 * (full form) and `record-visit.tsx` (fast path) build a `NewMeetingRecord`
 * for the SAME, unchanged `lib/meeting-service.ts::createMeeting()`. This
 * module is the single place that assembly happens, so the two screens'
 * payload-construction logic can't silently drift apart the way it had
 * before (each screen inlined its own object literal). `createMeeting()`
 * itself is untouched — this only builds its input.
 */

export interface MeetingStartCapture {
  capturedAt: string;
  gpsLat: number;
  gpsLng: number;
}

interface BuildMeetingRecordCommon {
  clientId: string | null;
  agentId: string;
  /** Auth uid (Storage RLS keys off `auth.uid()`, never `profileId`) — see NewMeetingRecord.photoToQueue's own doc. */
  authUserId: string;
  start: MeetingStartCapture;
  mode: MeetingMode;
  agendas: string[];
  /** ADR-030 Pass 2.5 companions, already resolved to profileId+kind by the caller (lib/team-roster.ts::inviteeKindForRole). */
  companions: CompanionSelection[];
  /** F-205 decision 2: true only when the requester is a sales_manager recording their own meeting. */
  companionsPreAccepted: boolean;
}

export interface BuildFullMeetingRecordInput extends BuildMeetingRecordCommon {
  flow: 'full';
  selfieUri: string;
  selfieEvidence?: { capturedAt: string; gpsLat: number; gpsLng: number };
  outcome: MeetingOutcome;
  contactName: string;
  contactPosition: string;
  meetingLocation: 'Client Office' | 'Online' | 'Others';
  otherLocation: string;
  remarks: string;
  /** ADR-044/046 point 7 — already gated by isCloseDealPoEligible() at the call site; omitted/null when not applicable. */
  poEvidence: { localPhotoUri: string; cycleId: string } | null;
  /**
   * F-003 gap fix (2026-08-09): end-of-meeting GPS, captured silently at
   * Save time (no dedicated button, same treatment as start GPS at Start) —
   * gives Prospect/In Progress meetings the same start-vs-end GPS admin
   * validation (ADR-019) the fast path already has via `endPhoto`. Optional
   * because a GPS failure at Save must not block the save itself (matches
   * `end_gps_lat`/`end_gps_lng` already being nullable on `NewMeetingRecord`).
   */
  endGps: { capturedAt: string; gpsLat: number; gpsLng: number } | null;
}

export interface BuildVisitMeetingRecordInput extends BuildMeetingRecordCommon {
  flow: 'visit';
  endPhoto: {
    uri: string;
    capturedAt: string;
    gpsLat: number;
    gpsLng: number;
  };
}

export type BuildMeetingRecordInput = BuildFullMeetingRecordInput | BuildVisitMeetingRecordInput;

/**
 * Builds the `NewMeetingRecord` passed to `createMeeting()`. Start GPS/
 * timestamp attribution (`gps_lat`/`gps_lng`/`start_captured_at`/
 * `logged_at`) always comes from `input.start` alone — a value locked in at
 * Start and never re-derived from anything captured later (RT-A5).
 */
export function buildMeetingRecord(input: BuildMeetingRecordInput): NewMeetingRecord {
  const base: NewMeetingRecord = {
    client_id: input.clientId,
    agent_id: input.agentId,
    gps_lat: input.start.gpsLat,
    gps_lng: input.start.gpsLng,
    meeting_mode: input.mode,
    agendas: input.agendas,
    outcome: null,
    start_captured_at: input.start.capturedAt,
    // O-1 (ADR-053): logged_at mirrors start_captured_at, not `new Date()`
    // at save time, so a slow/multi-step save never drifts cutoff
    // attribution to a later moment than when the meeting actually began.
    logged_at: input.start.capturedAt,
    companions: input.companions,
    companionsPreAccepted: input.companionsPreAccepted,
  };

  if (input.flow === 'visit') {
    return {
      ...base,
      // B-085: every in-person fast-path visit IS a Client Office visit —
      // this screen has no separate location chip, matching captureOfficePin below.
      locationType: input.mode === 'online' ? 'Others' : 'Client Office',
      end_photo_url: input.endPhoto.uri,
      end_captured_at: input.endPhoto.capturedAt,
      end_gps_lat: input.endPhoto.gpsLat,
      end_gps_lng: input.endPhoto.gpsLng,
      photoToQueue: { kind: 'end', localUri: input.endPhoto.uri, userId: input.authUserId },
      captureOfficePin: input.mode === 'in_person',
    };
  }

  return {
    ...base,
    outcome: input.outcome,
    selfie_url: input.selfieUri,
    selfie_captured_at: input.selfieEvidence?.capturedAt ?? null,
    selfie_gps_lat: input.selfieEvidence?.gpsLat ?? null,
    selfie_gps_lng: input.selfieEvidence?.gpsLng ?? null,
    contactPerson: input.contactName || null,
    contactPosition: input.contactPosition || null,
    locationType: input.meetingLocation,
    locationName: input.meetingLocation === 'Others' ? input.otherLocation : null,
    remarks: input.remarks || null,
    photoToQueue: { kind: 'selfie', localUri: input.selfieUri, userId: input.authUserId },
    poEvidence: input.poEvidence
      ? { localPhotoUri: input.poEvidence.localPhotoUri, cycleId: input.poEvidence.cycleId, userId: input.authUserId }
      : null,
    // Office Location Spec (2026-07-29): only an in-person 'Client Office'
    // meeting auto-captures the permanent office pin; Online/Others never do.
    captureOfficePin: input.mode === 'in_person' && input.meetingLocation === 'Client Office',
    // F-003 gap fix: null when the Save-time GPS fix failed/timed out — the
    // caller (record.tsx) already alerted and blocked the save in that case,
    // so reaching here with `endGps: null` only happens if that contract
    // ever changes; kept nullable rather than assumed-always-present.
    end_gps_lat: input.endGps?.gpsLat ?? null,
    end_gps_lng: input.endGps?.gpsLng ?? null,
    end_captured_at: input.endGps?.capturedAt ?? null,
  };
}
