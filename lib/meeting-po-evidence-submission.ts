import type { SQLiteDatabase } from 'expo-sqlite';
import { captureAndSubmitPoEvidence } from './po-confirmation-service';

// Split out of lib/meeting-service.ts::createMeeting() to keep that file
// under the 300-line project limit (2026-08-04).
//
// B-127 (Vince, 2026-08-20): this used to hand-roll the ordering that the
// outbox now does properly. PO confirmation was online-only (ADR-044
// decision 5) with a direct insert, so it had to guarantee by hand that the
// meeting had already reached Supabase — otherwise the insert violated
// `po_confirmation_requests_meeting_id_fkey` (B-088). That meant:
// `pushOutboxOnly()`, read back `meetings.sync_status`, sleep 1500ms, push
// again (B-091), then submit and hope.
//
// All of it is now redundant AND actively harmful:
//   - Redundant: `po_confirmation_requests` is a real outbox entity whose
//     registry config declares `dependencies` on both `clients` and
//     `meetings`. The push pipeline will not send the PO row until both of
//     its parents have synced, correctly and generically, with retries.
//   - Harmful: `pushOutboxOnly()` started a full push pass while
//     `captureAndSubmitPoEvidence()` was still writing to SQLite on the same
//     connection. That contention surfaced on-device as
//     `NativeStatement.finalizeAsync`/`NativeDatabase.prepareAsync` being
//     rejected with `ERR_INTERNAL_SQLITE_ERROR`, which took out the PO photo
//     queue insert and the follow-up sync.
//
// What remains is the offline-first contract this app is supposed to have:
// write locally, queue, let the sync engine deliver it.
export interface SubmitMeetingPoEvidenceInput {
  meetingId: string;
  clientId: string;
  agentId: string;
  poEvidence: { localPhotoUri: string; cycleId: string; userId: string };
}

export async function submitMeetingPoEvidenceIfPresent(
  db: SQLiteDatabase,
  input: SubmitMeetingPoEvidenceInput
): Promise<void> {
  await captureAndSubmitPoEvidence(db, {
    clientId: input.clientId,
    meetingId: input.meetingId,
    requesterId: input.agentId,
    cycleId: input.poEvidence.cycleId,
    localPhotoUri: input.poEvidence.localPhotoUri,
    userId: input.poEvidence.userId,
  });
}
