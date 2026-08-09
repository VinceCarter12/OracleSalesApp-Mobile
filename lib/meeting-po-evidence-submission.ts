import type { SQLiteDatabase } from 'expo-sqlite';
import { pushOutboxOnly } from './sync-engine';
import { captureAndSubmitPoEvidence } from './po-confirmation-service';

// Split out of lib/meeting-service.ts::createMeeting() to keep that file
// under the 300-line project limit (2026-08-04, same day as the local
// prospect→in_progress lifecycle mirror). Pure extraction: this is the exact
// B-088/B-091 logic (below) that already existed inline in meeting-service.ts
// before this split — verified against the working tree at the time of
// extraction, not against git HEAD, which was already far behind this
// session's uncommitted work. No behavior change from that pre-existing
// inline block.
//
// ADR-044 decision 5: PO capture is offline-safe, submission is a
// best-effort ONLINE-ONLY attempt, same pattern as photo-queue/runSync in
// meeting-service.ts. Never throws — see po-confirmation-service.ts.
//
// B-088: this meeting's own outbox row must land in Supabase BEFORE
// submitPoConfirmation()'s direct insert, or it violates
// po_confirmation_requests_meeting_id_fkey — same failure class as B-013's
// meetings→clients race. Unlike that fix, PO confirmation isn't
// outbox-queued (ADR-044 decision 5 forbids it), so there's no dependency
// guard to lean on here; push (and await) this meeting's sync explicitly
// instead. po-confirmation-service.ts's own isMeetingSynced() guard still
// covers the case where this push doesn't fully land (offline/transient).
//
// B-0XX (2026-08-09): uses `pushOutboxOnly()` (push half only), NOT
// `runSync()` (full push+pull pass) — this check only cares whether THIS
// meeting's outbox row pushed, which has nothing to do with `runSync()`'s
// pull half (agenda catalog/policy/stage rules/client cycles/cutoff data
// via `syncDown()`). Depending on the full pass meant a PO save could hang
// for up to two full sync passes waiting on unrelated background pulls.

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
  await pushOutboxOnly(input.agentId).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[meeting-service] pre-PO-evidence sync failed:', message);
  });
  // B-091: the push may resolve without having pushed THIS meeting's row yet
  // if another push was already in flight when this one was called. One
  // bounded retry covers that window; po-confirmation-service.ts's
  // isMeetingSynced() guard + its getMyPoConfirmationStatuses() retry-on-read
  // are the backstop if the meeting is still unsynced after this (e.g.
  // genuinely offline).
  const meetingRow = await db.getFirstAsync<{ sync_status: string }>(
    'SELECT sync_status FROM meetings WHERE id = ?',
    [input.meetingId]
  );
  if (meetingRow?.sync_status !== 'synced') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await pushOutboxOnly(input.agentId).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[meeting-service] pre-PO-evidence retry sync failed:', message);
    });
  }
  await captureAndSubmitPoEvidence(db, {
    clientId: input.clientId,
    meetingId: input.meetingId,
    requesterId: input.agentId,
    cycleId: input.poEvidence.cycleId,
    localPhotoUri: input.poEvidence.localPhotoUri,
    userId: input.poEvidence.userId,
  });
}
