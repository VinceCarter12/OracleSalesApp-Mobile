import type { ClientStatus, MeetingOutcome } from '../../types';

// 2026-08-04 (Vince-approved ADR-006 exception, see meeting-service.ts's
// createMeeting() comment near the old "server-side only" note): a
// PROVISIONAL, non-authoritative local mirror of ONLY the prospect ->
// in_progress edge of `advance_prospect_to_in_progress()` (Migration 043,
// see Decisions.md ADR-042). This exists purely so the device can show
// immediate local feedback after a qualifying meeting save, without waiting
// for the next sync-down. It must never be treated as authoritative — the
// server trigger remains the sole source of truth, and the caller
// (lib/meeting-service.ts) must never push this prediction through the
// outbox.
//
// Deliberately mirrors ONLY this one edge. The second edge
// (in_progress -> new, `advance_in_progress_to_new()`) additionally requires
// an APPROVED PO confirmation — a separate, later, asynchronous Manager
// decision that has not happened yet at meeting-save time. It is
// structurally impossible to predict correctly on-device, and this module
// must never attempt to.

export interface LocalLifecyclePredictionInput {
  /** The client's current LOCAL status, before this meeting was saved. */
  currentStatus: ClientStatus;
  /** This meeting's outcome. */
  outcome: MeetingOutcome | null;
  /** This meeting's agendas, already mapped to canonical catalog agenda_ids (lib/policies/agenda-label-mapping.ts). */
  agendaIds: readonly string[];
  /** The current agenda catalog's valid agenda_ids — membership is checked by id, never by display label. */
  validCatalogAgendaIds: ReadonlySet<string>;
  /** True if a MANAGER-kind tag-along is currently pending for this client (any prior meeting), or this meeting's OWN validity_status is 'pending_confirmation'. */
  hasPendingManagerTagAlong: boolean;
}

/**
 * Mirrors `advance_prospect_to_in_progress()`'s four gates exactly:
 * (1) current status is 'prospect', (2) outcome is 'Successful' (this
 * meeting is treated as the current cycle — cycle_id is stamped
 * server-side and unknowable on-device; assuming the owner's own
 * just-recorded meeting belongs to the client's current cycle is an
 * acceptable simplifying assumption for this PROVISIONAL prediction only,
 * corrected by the next sync-down in the rare edge case it's wrong),
 * (3) at least one agenda_id is in the current catalog's valid set, and
 * (4) no pending manager tag-along blocks the client. Conservative by
 * design: any doubt (e.g. the pending-tag-along boolean) must resolve to
 * `false` — the real status still arrives via the next sync-down regardless.
 */
export function predictsProspectToInProgress(input: LocalLifecyclePredictionInput): boolean {
  if (input.currentStatus !== 'prospect') return false;
  if (input.outcome !== 'Successful') return false;
  if (input.hasPendingManagerTagAlong) return false;
  return input.agendaIds.some((agendaId) => input.validCatalogAgendaIds.has(agendaId));
}
