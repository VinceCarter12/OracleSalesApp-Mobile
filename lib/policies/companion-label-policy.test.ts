import { describe, expect, it } from 'vitest';
import type { TeamRosterEntry } from '../../types';
import { companionRoleLabel } from './companion-label-policy';

const manager: TeamRosterEntry = {
  profileId: 'manager-1', fullName: 'Manager', role: 'sales_manager', teamId: 'team-1',
  isActive: true, avatarUrl: null, syncedAt: '2026-08-14T00:00:00Z',
};

describe('companionRoleLabel', () => {
  it('labels a same-team manager', () => expect(companionRoleLabel(manager, 'team-1')).toBe('Team Manager'));
  it('labels a cross-team manager', () => expect(companionRoleLabel(manager, 'team-2')).toBe('Guest Manager'));
  it('uses neutral Manager when team identity is missing', () => {
    expect(companionRoleLabel({ ...manager, teamId: '' }, 'team-1')).toBe('Manager');
    expect(companionRoleLabel(manager, null)).toBe('Manager');
  });
  it('keeps teammate labels unchanged', () => expect(companionRoleLabel({ ...manager, role: 'rsr' }, 'team-2')).toBe('Teammate'));
});
