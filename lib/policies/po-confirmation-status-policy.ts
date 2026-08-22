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
export type LocalPoConfirmationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'superseded' | 'duplicate_blocked';

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
  | 'superseded'
  | 'duplicate_blocked';

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
  submission_required: 'Not sent yet — the app sends it automatically when you\'re online',
  pending: 'Waiting for your manager\'s decision',
  approved: 'Purchase order photos approved',
  rejected: 'Purchase order photos not accepted',
  cancelled: 'Purchase order request cancelled',
  superseded: 'This can no longer be sent — contact your office administrator',
  duplicate_blocked: 'PO evidence saved on this device, but another PO is already active for this client cycle',
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
  duplicate_blocked: { background: 'soft', color: 'red' },
};

export const ACTIVE_PO_CONFIRMATION_STATUSES = new Set<LocalPoConfirmationStatus>(['draft', 'pending', 'approved']);
export function blocksPoConfirmationReplacement(status: LocalPoConfirmationStatus): boolean {
  return ACTIVE_PO_CONFIRMATION_STATUSES.has(status);
}

/** Any active row reserves a client/cycle slot; terminal history alone does not. */
export function hasActivePoConfirmation(rows: readonly LocalPoConfirmationStatus[]): boolean {
  return rows.some(blocksPoConfirmationReplacement);
}

/**
 * B-125 (Vince, 2026-08-20): statuses that exist ONLY on this device. The
 * server has never seen them, so they hold no real reservation and must never
 * permanently block a new PO.
 *
 * This is the concrete failure Vince reported: a `draft` that never reached
 * Supabase — for any of the reasons catalogued in B-120, and guaranteed for
 * every device while B-124 was live — silently reserved the client/cycle slot
 * forever. The agent could not file a PO for that client again, and the old
 * blocking dialog's only forward option was "Continue meeting without new PO",
 * which discarded the new evidence rather than replacing the stale row.
 */
export const LOCAL_ONLY_PO_CONFIRMATION_STATUSES = new Set<LocalPoConfirmationStatus>([
  'draft',
  'duplicate_blocked',
  'superseded',
]);

/**
 * Statuses the SERVER has confirmed. Only these genuinely reserve the slot.
 *
 * Deliberately matches the server's own authority, not a stricter local guess:
 * web migration 039 declares `unique index uq_po_pending_per_cycle on
 * (cycle_id) where status = 'pending'`. `approved` is included here on top of
 * that because ADR-060 (Vince, 2026-08-14) rules that an approved PO also
 * closes the cycle's slot — a product rule, not a database constraint. If that
 * rule is ever relaxed, remove `approved` here and nothing else changes.
 */
export const SERVER_CONFIRMED_PO_CONFIRMATION_STATUSES = new Set<LocalPoConfirmationStatus>([
  'pending',
  'approved',
]);

/**
 * `free` — nothing holds the slot.
 * `replaceable_local` — only local-only evidence holds it; warn, then replace.
 * `server_confirmed` — a real server-side PO holds it; genuinely blocked.
 */
export type PoConfirmationSlotState = 'free' | 'replaceable_local' | 'server_confirmed';

/** Server-confirmed wins over local-only: a device holding both must be treated as genuinely blocked. */
export function derivePoConfirmationSlotState(
  rows: readonly LocalPoConfirmationStatus[]
): PoConfirmationSlotState {
  if (rows.some((status) => SERVER_CONFIRMED_PO_CONFIRMATION_STATUSES.has(status))) return 'server_confirmed';
  if (rows.some((status) => LOCAL_ONLY_PO_CONFIRMATION_STATUSES.has(status))) return 'replaceable_local';
  return 'free';
}

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
 *
 * ADR-061 (Vince, 2026-08-19/20): `prospect` joins `in_progress` here.
 * Scenario 1 — a prospect may attach PO evidence directly (Close deal is
 * OPTIONAL at this stage, per agenda-policy.ts's DEFAULT_AGENDA_STAGE_RULES
 * update) and route straight to manager approval -> `new`, skipping
 * `in_progress` entirely if approved. The outcome/agenda conditions are
 * unchanged and apply identically at both stages — a PO always means a
 * closed deal, regardless of which stage the client started the meeting at.
 */
export function isCloseDealPoEligible(
  clientStatus: ClientStatus | null | undefined,
  outcome: MeetingOutcome | null | undefined,
  agendas: readonly string[]
): boolean {
  return (
    (clientStatus === 'in_progress' || clientStatus === 'prospect') &&
    outcome === 'Successful' &&
    agendas.includes(CLOSE_DEAL_AGENDA)
  );
}
