/**
 * Step B (meeting-recording controller consolidation): pure derivation of
 * what a resumed meeting draft does NOT restore, per flow. Both
 * `record.tsx` (full form) and `record-visit.tsx` (fast path) share the same
 * `lib/meeting-drafts.ts` persistence mechanism. As of 2026-08-04 (Vince
 * direction), agenda ticks are also persisted (`MeetingDraftPayload.agendas`,
 * lib/policies/meeting-draft-policy.ts) — the fast path's draft is now a
 * FULL restore; the full form's is still PARTIAL, since outcome/remarks are
 * only ever entered post-Start and have never been part of the draft
 * payload. This module is the single place that "partial" is defined, so
 * the disclosure UI (components/meetings/DraftResumePrompt.tsx) and any
 * future consumer can't drift from each other about which fields still need
 * re-entry.
 */

/** Fields NOT persisted by MeetingDraftPayload, only ever entered post-Start. */
export type ResumableMeetingField = 'outcome' | 'remarks';

// Fast path (record-visit.tsx) restores everything it collects — nothing
// left to re-enter.
const VISIT_REENTRY_FIELDS: readonly ResumableMeetingField[] = [];
// The full form additionally collects outcome + remarks post-Start, neither
// of which the draft payload has ever persisted (see MeetingDraftPayload).
const FULL_REENTRY_FIELDS: readonly ResumableMeetingField[] = ['outcome', 'remarks'];

/**
 * Returns the exact set of fields the agent must re-enter after resuming a
 * draft for the given flow. Order matches the fields' on-screen order in
 * each flow so the disclosure copy can list them naturally.
 */
export function getFieldsRequiringReentryAfterResume(flow: 'full' | 'visit'): readonly ResumableMeetingField[] {
  return flow === 'full' ? FULL_REENTRY_FIELDS : VISIT_REENTRY_FIELDS;
}
