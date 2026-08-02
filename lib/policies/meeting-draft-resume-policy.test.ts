import { describe, expect, it } from 'vitest';
import { getFieldsRequiringReentryAfterResume } from './meeting-draft-resume-policy';

describe('getFieldsRequiringReentryAfterResume', () => {
  it('fast-path visit only ever needs agenda re-ticked (companions/mode/GPS/time restore fully)', () => {
    expect(getFieldsRequiringReentryAfterResume('visit')).toEqual(['agenda']);
  });

  it('full form additionally needs outcome + remarks re-entered — the draft payload never persisted them', () => {
    expect(getFieldsRequiringReentryAfterResume('full')).toEqual(['agenda', 'outcome', 'remarks']);
  });
});
