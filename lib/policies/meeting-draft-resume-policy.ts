/**
 * Step B (meeting-recording controller consolidation): pure derivation of
 * what a resumed meeting draft does NOT restore, per flow. Both
 * `record.tsx` (full form) and `record-visit.tsx` (fast path) now share the
 * same `lib/meeting-drafts.ts` persistence mechanism, but its
 * `MeetingDraftPayload` (lib/policies/meeting-draft-policy.ts) only ever
 * persisted mode/GPS/time/companions — never agenda, outcome, or remarks.
 * A resumed draft is therefore always a PARTIAL restore; this module is the
 * single place that "partial" is defined, so the disclosure UI
 * (components/meetings/DraftResumePrompt.tsx) and any future consumer can't
 * drift from each other about which fields still need re-entry.
 */

/** Fields NOT persisted by MeetingDraftPayload, only ever entered post-Start. */
export type ResumableMeetingField = 'agenda' | 'outcome' | 'remarks';

const VISIT_REENTRY_FIELDS: readonly ResumableMeetingField[] = ['agenda'];
// The full form additionally collects outcome + remarks post-Start, neither
// of which the draft payload has ever persisted (see MeetingDraftPayload).
const FULL_REENTRY_FIELDS: readonly ResumableMeetingField[] = ['agenda', 'outcome', 'remarks'];

/**
 * Returns the exact set of fields the agent must re-enter after resuming a
 * draft for the given flow. Order matches the fields' on-screen order in
 * each flow so the disclosure copy can list them naturally.
 */
export function getFieldsRequiringReentryAfterResume(flow: 'full' | 'visit'): readonly ResumableMeetingField[] {
  return flow === 'full' ? FULL_REENTRY_FIELDS : VISIT_REENTRY_FIELDS;
}
