import { isCloseDealPoEligible } from './po-confirmation-status-policy';
import type { ClientStatus, MeetingOutcome } from '../../types';

export interface MeetingCandidateRow {
  id: string;
  outcome: string | null;
  agendas: string | null;
  client_status_at_meeting: string | null;
  start_photo_url: string | null;
  end_photo_url: string | null;
  start_captured_at: string | null;
  po_confirmation_status: string | null;
}

const COUNTABLE_OUTCOMES = new Set(['Successful', 'Follow-up Required']);
// Any status after `draft` means the confirmation row reached the server.
// Approval/rejection is deliberately not part of quota eligibility.
const SUBMITTED_PO_CONFIRMATION_STATUSES = new Set(['pending', 'approved', 'rejected', 'cancelled']);

/** Returns true only when all local evidence required for quota is present. */
export function isQualifyingLocalMeeting(row: MeetingCandidateRow): boolean {
  // New/Existing customer visits use the fast path: they intentionally have
  // no outcome or start photo (the Start button captures GPS/time only), and
  // the end photo is the completion evidence. They still consume the agent's
  // cutoff quota once the local meeting is complete. Keep this branch before
  // the full-form outcome/evidence checks so the fast-path shape is not
  // mistaken for an incomplete meeting.
  if (row.client_status_at_meeting === 'new' || row.client_status_at_meeting === 'existing') {
    return Boolean(row.start_captured_at && row.end_photo_url);
  }

  if (!row.outcome || !COUNTABLE_OUTCOMES.has(row.outcome)) return false;
  if (!row.start_captured_at || !row.start_photo_url || !row.end_photo_url) return false;

  let agendas: unknown = [];
  try {
    agendas = row.agendas ? JSON.parse(row.agendas) : [];
  } catch {
    agendas = [];
  }
  const selectedAgendas = Array.isArray(agendas) ? agendas.filter((value): value is string => typeof value === 'string') : [];
  if (!isCloseDealPoEligible(row.client_status_at_meeting as ClientStatus | null, row.outcome as MeetingOutcome | null, selectedAgendas)) {
    return true;
  }

  // A draft was captured locally but has not uploaded. A superseded row was
  // permanently rejected before submission (for example by upload/RLS error).
  // Once submitted, the Manager's decision does not affect quota counting.
  return SUBMITTED_PO_CONFIRMATION_STATUSES.has(row.po_confirmation_status ?? '');
}
