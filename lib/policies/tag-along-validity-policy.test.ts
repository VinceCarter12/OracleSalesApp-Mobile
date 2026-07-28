import { describe, expect, it } from 'vitest';
import { computeMeetingValidityStatusOnCreate, shouldMeetingBecomeValid } from './tag-along-validity-policy';

describe('computeMeetingValidityStatusOnCreate', () => {
  it('is pending_confirmation when a MANAGER companion is selected (not pre-accepted)', () => {
    expect(computeMeetingValidityStatusOnCreate([{ kind: 'manager' }], false)).toBe('pending_confirmation');
  });

  it('is valid when only a TEAMMATE companion is selected — never blocks validity', () => {
    expect(computeMeetingValidityStatusOnCreate([{ kind: 'teammate' }], false)).toBe('valid');
  });

  it('is valid with no companions selected', () => {
    expect(computeMeetingValidityStatusOnCreate([], false)).toBe('valid');
  });

  it('is valid for a manager companion when pre-accepted (F-205: manager recording their own meeting)', () => {
    expect(computeMeetingValidityStatusOnCreate([{ kind: 'manager' }], true)).toBe('valid');
  });

  it('is pending_confirmation when a manager AND teammate are both selected (not pre-accepted)', () => {
    expect(computeMeetingValidityStatusOnCreate([{ kind: 'teammate' }, { kind: 'manager' }], false)).toBe(
      'pending_confirmation'
    );
  });
});

describe('shouldMeetingBecomeValid', () => {
  it('stays excluded while a manager tag-along is still pending', () => {
    expect(shouldMeetingBecomeValid(1, 0)).toBe(false);
  });

  it('clears to valid once accepted (zero pending, zero declined)', () => {
    expect(shouldMeetingBecomeValid(0, 0)).toBe(true);
  });

  it('stays excluded permanently once declined, even after the pending count reaches zero', () => {
    expect(shouldMeetingBecomeValid(0, 1)).toBe(false);
  });

  it('stays excluded when a second manager gate on the same meeting is still pending, even if one already declined', () => {
    expect(shouldMeetingBecomeValid(1, 1)).toBe(false);
  });
});
