import type { MeetingMode, MeetingOutcome } from '../types';
import type { RemoteMeetingOutcome, RemoteMeetingType } from '../types/database';

// ADR-026 P2 item 8: pure value-translation functions for the `meetings`
// table, extracted out of lib/meeting-service.ts and lib/sync/entity-appliers.ts
// (the latter had its own private duplicate to sidestep a circular import —
// see that file's history). Zero DB/network imports here, mirroring
// lib/remote-client-mapping.ts's shape exactly, so both meeting-service.ts
// and entity-appliers.ts can safely import from this file without creating
// a cycle.
//
// Remote CHECK constraints confirmed 2026-07-16 via `pg_constraint` (see
// Bugs.md B-012):
// `meetings_meeting_type_check`: ('f2f', 'online')
// `meetings_location_type_check`: ('client_office', 'other')
// `meetings_outcome_check`: ('successful', 'follow_up', 'no_decision', 'lost_opportunity')

export function toRemoteMeetingType(mode: MeetingMode): RemoteMeetingType {
  return mode === 'online' ? 'online' : 'f2f';
}

/** Reverse of `toRemoteMeetingType` — needed by anything reading meetings straight from Supabase. */
export function fromRemoteMeetingType(meetingType: RemoteMeetingType | null): MeetingMode {
  return meetingType === 'online' ? 'online' : 'in_person';
}

export function toRemoteLocationType(locationType: string | null | undefined): 'client_office' | 'other' {
  if (!locationType) return 'client_office';
  return locationType === 'Others' ? 'other' : 'client_office';
}

/** Reverse of `toRemoteLocationType` — needed by anything reading meetings straight from Supabase. */
export function fromRemoteLocationType(locationType: string | null | undefined): string | null {
  if (!locationType) return null;
  return locationType === 'other' ? 'Others' : 'Client Office';
}

const OUTCOME_TO_REMOTE: Record<MeetingOutcome, RemoteMeetingOutcome> = {
  Successful: 'successful',
  'Follow-up Required': 'follow_up',
  'No Decision': 'no_decision',
  'Lost Opportunity': 'lost_opportunity',
};

export function toRemoteOutcome(outcome: MeetingOutcome | null): RemoteMeetingOutcome {
  return outcome ? OUTCOME_TO_REMOTE[outcome] : 'successful';
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
