import { describe, expect, it } from 'vitest';
import { classifyAccountStatus, toActiveProfileSnapshot } from './account-status-classify';

describe('classifyAccountStatus', () => {
  it('returns active when is_active is true', () => {
    expect(classifyAccountStatus({ data: { is_active: true }, error: null })).toBe('active');
  });

  it('returns suspended ONLY when is_active is explicitly false on a successful response', () => {
    expect(classifyAccountStatus({ data: { is_active: false }, error: null })).toBe('suspended');
  });

  it('returns unverified (never suspended) on a query error', () => {
    expect(classifyAccountStatus({ data: null, error: { message: 'network error' } })).toBe('unverified');
  });

  it('returns unverified (never suspended) when there is no row and no error', () => {
    expect(classifyAccountStatus({ data: null, error: null })).toBe('unverified');
  });

  it('returns unverified even if an error is present alongside data (defensive — error always wins)', () => {
    expect(classifyAccountStatus({ data: { is_active: false }, error: { message: 'timeout' } })).toBe('unverified');
  });
});

describe('toActiveProfileSnapshot', () => {
  it('maps a profiles row to the WritableSessionSnapshot-minus-profileId shape', () => {
    const snapshot = toActiveProfileSnapshot({
      user_id: 'auth-user-1',
      role: 'sales_specialist',
      team_id: 'team-1',
      full_name: 'Test Agent',
    });
    expect(snapshot).toEqual({
      userId: 'auth-user-1',
      role: 'sales_specialist',
      teamId: 'team-1',
      fullName: 'Test Agent',
    });
  });

  it('preserves a null team_id (unassigned manager/executive)', () => {
    const snapshot = toActiveProfileSnapshot({
      user_id: 'auth-user-2',
      role: 'executive',
      team_id: null,
      full_name: 'No Team Exec',
    });
    expect(snapshot.teamId).toBeNull();
  });

  it('falls back to an empty string full name when full_name is null', () => {
    const snapshot = toActiveProfileSnapshot({
      user_id: 'auth-user-3',
      role: 'rsr',
      team_id: 'team-2',
      full_name: null,
    });
    expect(snapshot.fullName).toBe('');
  });
});
