export interface MeetingCandidateRow {
  id: string;
  outcome: string | null;
  agendas: string | null;
  client_status_at_meeting: string | null;
  start_photo_url: string | null;
  end_photo_url: string | null;
  /**
   * The local mirror of the server's `meetings.photo_url` — see
   * lib/sync/photo-upload-registry.ts, where the `selfie` kind maps
   * localColumn `selfie_url` to remoteColumn `photo_url`. This is the column
   * the server's evidence test actually reads.
   */
  selfie_url: string | null;
  start_captured_at: string | null;
  /**
   * Still selected by callers and still meaningful elsewhere in the PO
   * workflow, but deliberately NOT read here any more — see the doc comment
   * on `isQualifyingLocalMeeting()`.
   */
  po_confirmation_status: string | null;
}

// A completed meeting counts regardless of its non-lost outcome. Lost
// Opportunity is intentionally excluded; a missing outcome is only valid for
// the New/Existing fast-path, which uses its end photo as completion proof.
// Matches the live server gate in `attribute_meeting_cutoff()` (web migration
// 098) exactly: `m.outcome in ('successful','follow_up','no_decision')`.
const COUNTABLE_OUTCOMES = new Set(['Successful', 'Follow-up Required', 'No Decision']);

/**
 * Returns true only when all local evidence required for quota is present.
 *
 * ADR-062 (Vince, 2026-08-19): a meeting counts toward quota **as soon as the
 * agent records it**, for prospect and in_progress alike, displayed offline
 * immediately — it is never held back waiting for PO evidence to reach the
 * server.
 *
 * This removed a PO gate that had no counterpart on the server. The live
 * `attribute_meeting_cutoff()` (web migration 098; 107 only wraps it in
 * `reattribute_meeting_cutoff()`, 108 is a backfill) gates solely on
 *
 *   if declined
 *      or m.outcome not in ('successful','follow_up','no_decision')
 *      or not has_valid_evidence
 *
 * There is no PO check anywhere in server-side attribution and there never
 * has been. Requiring one here made mobile strictly stricter than the server,
 * so an agent saw "not counted yet" for a meeting already credited in
 * `meeting_cutoff_attributions` — worst for offline agents, since PO
 * submission is online-only (ADR-044 decision 5, no outbox lane). See B-121.
 *
 * The two gates below are the local mirror of the server's own: outcome, and
 * evidence. Nothing else belongs in this function.
 */
export function isQualifyingLocalMeeting(row: MeetingCandidateRow): boolean {
  // New/Existing customer visits use the fast path: they intentionally have
  // no outcome or start photo (the Start button captures GPS/time only), and
  // the end photo is the completion evidence. They still consume the agent's
  // cutoff quota once the local meeting is complete. Keep this branch before
  // the full-form outcome/evidence checks so the fast-path shape is not
  // mistaken for an incomplete meeting. Mirrors 098's own `has_valid_evidence`
  // second arm (`client_status_at_meeting in ('new','existing') and
  // start_captured_at is not null and end_photo_url is not null`).
  if (row.client_status_at_meeting === 'new' || row.client_status_at_meeting === 'existing') {
    return Boolean(row.start_captured_at && row.end_photo_url);
  }

  if (!row.outcome || !COUNTABLE_OUTCOMES.has(row.outcome)) return false;
  // Mirrors web migration 098's `has_valid_evidence`, which for anything but the
  // new/existing fast path accepts exactly one thing: `meetings.photo_url`.
  // That column is fed from the local `selfie_url` (photo-upload-registry.ts,
  // kind `selfie`).
  //
  // This previously required `start_photo_url && end_photo_url`. NOTHING in the
  // upload registry ever writes `start_photo_url` — the only two meeting kinds
  // are `selfie` -> selfie_url and `end` -> end_photo_url — so the condition
  // could never be satisfied and this function returned false for every
  // full-form meeting. The visible effect was a pending chip frozen at 0 while
  // the server happily counted the same meetings as confirmed, because the two
  // rules were reading different columns.
  //
  // No PO-status check here — per this function's own doc comment (ADR-062),
  // the server's gate is outcome + evidence only. Nothing else belongs here.
  return Boolean(row.start_captured_at && row.selfie_url);
}
