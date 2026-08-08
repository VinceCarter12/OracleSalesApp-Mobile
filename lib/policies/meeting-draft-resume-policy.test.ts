import { describe, expect, it } from 'vitest';
import { getFieldsRequiringReentryAfterResume } from './meeting-draft-resume-policy';

describe('getFieldsRequiringReentryAfterResume', () => {
  // 2026-08-04 follow-up: agenda ticks are now part of the draft payload too
  // (MeetingDraftPayload.agendas) — the fast path's resume is a FULL restore,
  // nothing left to re-enter.
  it('fast-path visit restores fully — agenda/companions/mode/GPS/time all persist, nothing to re-enter', () => {
    expect(getFieldsRequiringReentryAfterResume('visit')).toEqual([]);
  });

  it('full form still needs outcome + remarks re-entered — the draft payload never persisted them', () => {
    expect(getFieldsRequiringReentryAfterResume('full')).toEqual(['outcome', 'remarks']);
  });
});
