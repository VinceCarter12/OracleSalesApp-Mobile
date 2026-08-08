import { CLOSE_DEAL_AGENDA, type ClientStatus, type MeetingOutcome } from '../../types';

// ADR-044 (Migration 039) + ADR-046 point 7 (Batch 3, Slice 5): pure status
// derivation for the PO confirmation workflow. No I/O — callers
// (lib/po-confirmation-service.ts) own fetching the local SQLite row / the
// `get_my_request_statuses()` / `get_manager_approval_feed()` RPC rows and
// pass plain values in here, same convention as every other file in this
// directory (lib/policies/tag-along-validity-policy.ts, agenda-policy.ts).
//
// Local-only `'draft'` (lib/db.ts's po_confirmation_requests table) means
// "evidence captured, never submitted" — ADR-044 decision 5 requires PO
// confirmation creation to be online-only (no outbox queueing), so a row
// captured offline has no server counterpart yet. It is NEVER a valid
// value on the wire (`RemotePoConfirmationStatus`, types/database.ts) —
// only a local bookkeeping state.
export type LocalPoConfirmationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'superseded';

// ADR-046 point 7's exact display vocabulary: "submission_required /
// pending / approved / rejected" — 'cancelled' is added for completeness
// (Migration 039 line 39's CHECK constraint includes it, e.g. a requester
// cancelling their own pending request) even though ADR-046 doesn't name it.
// 'superseded' (2026-08-04, SQLite v24) mirrors `client_edit_requests`'
// existing local-only terminal state: a submission the server permanently
// rejected (RLS ownership check failed — e.g. the client was reassigned or
// removed since the draft was captured), never a value that reaches the
// wire.
export type PoConfirmationDisplayStatus =
  | 'submission_required'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'superseded';

/**
 * Maps a local row's status to the display vocabulary ADR-046 point 7
 * specifies. `'draft'` (never submitted, e.g. captured while offline) is the
 * only status that renames — every other value passes through unchanged,
 * since the local CHECK constraint and `RemotePoConfirmationStatus` already
 * agree on the rest.
 */
export function derivePoConfirmationDisplayStatus(
  status: LocalPoConfirmationStatus
): PoConfirmationDisplayStatus {
  return status === 'draft' ? 'submission_required' : status;
}

/** A permanently-rejected submission can never be retried — distinct from 'draft', which always can. */
export function isTerminalPoConfirmationFailure(status: LocalPoConfirmationStatus): boolean {
  return status === 'superseded';
}

/** A draft (never-submitted) row is the only one eligible for `submitPoConfirmation()` — every other status already went through (or past) the server. */
export function canSubmitPoConfirmation(status: LocalPoConfirmationStatus): boolean {
  return status === 'draft';
}

/**
 * ADR-044 decision 5: "Offline devices see the approval screens disabled
 * with an explanation" — same rule applies to the Sales-side submit action.
 * Pure gate so the UI/service layer never has to re-derive this from two
 * separate booleans (online AND draft) inconsistently.
 */
export function canAttemptSubmission(status: LocalPoConfirmationStatus, isOnline: boolean): boolean {
  return isOnline && canSubmitPoConfirmation(status);
}

export const PO_CONFIRMATION_STATUS_LABELS: Record<PoConfirmationDisplayStatus, string> = {
  submission_required: 'Hindi pa naisusumite — mag-sync kapag online',
  pending: 'Naghihintay ng approval ng Manager',
  approved: 'Na-approve ang PO evidence',
  rejected: 'Na-reject ang PO evidence',
  cancelled: 'Kinansela ang PO request',
  superseded: 'Hindi na maisusumite — kontakin ang admin/IT',
};

/** Badge tone tokens (BIZLINK_COLORS keys, matching COMPANION_REQUEST_BADGE_TONES's convention in lib/tag-along-service.ts). */
export const PO_CONFIRMATION_BADGE_TONES: Record<
  PoConfirmationDisplayStatus,
  { background: 'soft' | 'tintA'; color: 'muted' | 'ink' | 'brand' | 'red' }
> = {
  submission_required: { background: 'soft', color: 'muted' },
  pending: { background: 'tintA', color: 'ink' },
  approved: { background: 'tintA', color: 'brand' },
  rejected: { background: 'soft', color: 'red' },
  cancelled: { background: 'soft', color: 'muted' },
  superseded: { background: 'soft', color: 'red' },
};

// ADR-046 correction addendum point 3: the live discriminator literal —
// never the shorthand 'po'. Exported so every call site (service, UI) reads
// this constant instead of re-typing the string literal.
export const PO_CONFIRMATION_REQUEST_KIND = 'po_confirmation' as const;

/**
 * ADR-046 point 2 / Wireframe-Sales-BizLink.html:2152's `poRequestPending`:
 * `client.status==='in_progress' && meeting.outcome==='success' &&
 * meeting.agenda.indexOf('Close deal')>-1` (the wireframe's own
 * `aPoEvidenceConfirmed` flag is the equivalent of "a PO photo has been
 * attached" here, checked separately by the caller alongside this gate —
 * see lib/meeting-service.ts's `poEvidence` construction and
 * components/meetings/PoEvidenceCard's `visible` prop in record.tsx).
 *
 * A prior bug (Batch 3, quality-gate finding) omitted the outcome check
 * entirely, letting a Close-deal + PO-photo + non-Successful-outcome
 * combination submit a real po_confirmation_requests row — this function is
 * the single place that condition is now expressed so both call sites (the
 * evidence card's visibility and the actual submission trigger) can never
 * drift apart again.
 */
export function isCloseDealPoEligible(
  clientStatus: ClientStatus | null | undefined,
  outcome: MeetingOutcome | null | undefined,
  agendas: readonly string[]
): boolean {
  return clientStatus === 'in_progress' && outcome === 'Successful' && agendas.includes(CLOSE_DEAL_AGENDA);
}
