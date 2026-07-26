import { MEETING_AGENDAS } from '../../types';

// Agenda label normalization. Normalization happens at read/deserialization
// time only — this module NEVER rewrites stored data or queued outbox
// payloads. Existing SQLite rows / outbox payloads that still carry the
// legacy 'Closed deal' string stay exactly as written; callers normalize on
// the way out for comparison/display purposes only.

export type MeetingAgenda = (typeof MEETING_AGENDAS)[number];

export const CANONICAL_CLOSE_DEAL_AGENDA = 'Close deal';
export const LEGACY_CLOSED_DEAL_AGENDA = 'Closed deal';

/** Maps the legacy 'Closed deal' label to the canonical 'Close deal' label; any other label passes through unchanged. */
export function getCanonicalAgenda(label: string): string {
  return label === LEGACY_CLOSED_DEAL_AGENDA ? CANONICAL_CLOSE_DEAL_AGENDA : label;
}

/** Maps getCanonicalAgenda over an array of labels. */
export function getCanonicalAgendas(labels: readonly string[]): string[] {
  return labels.map(getCanonicalAgenda);
}

export function isKnownAgenda(label: string): label is MeetingAgenda {
  return (MEETING_AGENDAS as readonly string[]).includes(label);
}
