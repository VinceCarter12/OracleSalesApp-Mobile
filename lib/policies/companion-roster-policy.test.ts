import { describe, expect, it } from 'vitest';
import { getCompanionRosterForViewer, inviteeKindForRole } from './companion-roster-policy';
import type { TeamRosterEntry } from '../../types';

const manager: TeamRosterEntry = {
  profileId: 'p-manager',
  fullName: 'Erika Bautista',
  role: 'sales_manager',
  teamId: 'team-1',
  isActive: true,
  avatarUrl: null,
  syncedAt: '2026-07-28T00:00:00.000Z',
};

const teammate: TeamRosterEntry = {
  profileId: 'p-teammate',
  fullName: 'Jun Reyes',
  role: 'sales_specialist',
  teamId: 'team-1',
  isActive: true,
  avatarUrl: null,
  syncedAt: '2026-07-28T00:00:00.000Z',
};

describe('getCompanionRosterForViewer', () => {
  // ADR-046 decision 4 / correction addendum: a Manager's own meeting form
  // must never offer a Manager option — the out-of-scope but data-possible
  // multi-manager-per-team edge case (getTeamRoster()'s `.neq('id', ...)`
  // only excludes the viewer, not other managers).
  it('strips every Manager tile from the roster when the viewer is a sales_manager', () => {
    const result = getCompanionRosterForViewer([manager, teammate], 'sales_manager', 'team-1');
    expect(result).toEqual([teammate]);
  });

  it('does not expose inactive teammates to a Manager', () => {
    expect(getCompanionRosterForViewer([{ ...teammate, isActive: false }, teammate], 'sales_manager', 'team-1')).toEqual([teammate]);
  });

  it('strips every teammate tile for a non-manager viewer — only their manager stays a valid companion', () => {
    const result = getCompanionRosterForViewer([manager, teammate], 'sales_specialist', 'team-1');
    expect(result).toEqual([manager]);
  });

  it('strips every teammate tile for an RSR viewer too', () => {
    const result = getCompanionRosterForViewer([manager, teammate], 'rsr', 'team-1');
    expect(result).toEqual([manager]);
  });

  it('returns an empty array unchanged regardless of viewer role', () => {
    expect(getCompanionRosterForViewer([], 'sales_manager', 'team-1')).toEqual([]);
    expect(getCompanionRosterForViewer([], 'sales_specialist', 'team-1')).toEqual([]);
  });

  it('fails closed when the viewer role is unresolved', () => {
    expect(getCompanionRosterForViewer([manager, teammate], null, 'team-1')).toEqual([]);
  });

  it('removes inactive entries before applying the manager-only Sales/RSR rule', () => {
    expect(getCompanionRosterForViewer([{ ...manager, isActive: false }, manager], 'sales_specialist', 'team-1')).toEqual([manager]);
  });

  it('fails closed for no team and excludes cross-team cached entries', () => {
    const crossTeamManager = { ...manager, profileId: 'p-other-manager', teamId: 'team-2' };
    expect(getCompanionRosterForViewer([manager, crossTeamManager], 'sales_specialist', 'team-1')).toEqual([manager]);
    expect(getCompanionRosterForViewer([manager], 'sales_specialist', null)).toEqual([]);
  });

  it('fails closed for legacy cache entries without an affirmative active state', () => {
    expect(getCompanionRosterForViewer([{ ...manager, isActive: false }], 'sales_specialist', 'team-1')).toEqual([]);
  });
});

describe('inviteeKindForRole', () => {
  it('maps sales_manager to manager', () => {
    expect(inviteeKindForRole('sales_manager')).toBe('manager');
  });

  it('maps any non-manager team role to teammate', () => {
    expect(inviteeKindForRole('sales_specialist')).toBe('teammate');
    expect(inviteeKindForRole('rsr')).toBe('teammate');
  });
});
