import { describe, expect, it } from 'vitest';
import { decideBootstrapOutcome } from './bootstrap-decision';
import type { SessionSnapshot } from './session-snapshot';

const validSnapshot: SessionSnapshot = {
  schemaVersion: 1,
  userId: 'auth-user-1',
  profileId: 'profile-1',
  role: 'sales_specialist',
  teamId: 'team-1',
  fullName: 'Test Agent',
  cachedAt: '2026-07-30T00:00:00.000Z',
};

describe('decideBootstrapOutcome', () => {
  it('rehydrates when the session user id matches the snapshot', () => {
    expect(decideBootstrapOutcome('auth-user-1', validSnapshot)).toEqual({
      kind: 'rehydrate',
      snapshot: validSnapshot,
    });
  });

  it('signs out without clearing when there is no session', () => {
    expect(decideBootstrapOutcome(null, validSnapshot)).toEqual({
      kind: 'signed_out',
      shouldClearSnapshot: false,
    });
  });

  it('signs out without clearing when there is no snapshot', () => {
    expect(decideBootstrapOutcome('auth-user-1', null)).toEqual({
      kind: 'signed_out',
      shouldClearSnapshot: false,
    });
  });

  it('signs out without clearing when neither a session nor a snapshot exist', () => {
    expect(decideBootstrapOutcome(null, null)).toEqual({
      kind: 'signed_out',
      shouldClearSnapshot: false,
    });
  });

  it('signs out AND clears the snapshot when the snapshot belongs to a different account (cross-account leak guard)', () => {
    expect(decideBootstrapOutcome('auth-user-2', validSnapshot)).toEqual({
      kind: 'signed_out',
      shouldClearSnapshot: true,
    });
  });
});
