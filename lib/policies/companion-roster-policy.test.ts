import { describe, expect, it } from 'vitest';
import { getCompanionRosterForViewer, inviteeKindForRole } from './companion-roster-policy';
import type { TeamRosterEntry } from '../../types';

const manager: TeamRosterEntry = {
  profileId: 'p-manager',
  fullName: 'Erika Bautista',
  role: 'sales_manager',
  teamId: 'team-1',
  avatarUrl: null,
  syncedAt: '2026-07-28T00:00:00.000Z',
};

const teammate: TeamRosterEntry = {
  profileId: 'p-teammate',
  fullName: 'Jun Reyes',
  role: 'sales_specialist',
  teamId: 'team-1',
  avatarUrl: null,
  syncedAt: '2026-07-28T00:00:00.000Z',
};

describe('getCompanionRosterForViewer', () => {
  // ADR-046 decision 4 / correction addendum: a Manager's own meeting form
  // must never offer a Manager option — the out-of-scope but data-possible
  // multi-manager-per-team edge case (getTeamRoster()'s `.neq('id', ...)`
  // only excludes the viewer, not other managers).
  it('strips every Manager tile from the roster when the viewer is a sales_manager', () => {
    const result = getCompanionRosterForViewer([manager, teammate], 'sales_manager');
    expect(result).toEqual([teammate]);
  });

  it('strips every teammate tile for a non-manager viewer — only their manager stays a valid companion', () => {
    const result = getCompanionRosterForViewer([manager, teammate], 'sales_specialist');
    expect(result).toEqual([manager]);
  });

  it('strips every teammate tile for an RSR viewer too', () => {
    const result = getCompanionRosterForViewer([manager, teammate], 'rsr');
    expect(result).toEqual([manager]);
  });

  it('returns an empty array unchanged regardless of viewer role', () => {
    expect(getCompanionRosterForViewer([], 'sales_manager')).toEqual([]);
    expect(getCompanionRosterForViewer([], 'sales_specialist')).toEqual([]);
  });

  it('returns the roster unfiltered when the viewer role is null (session not yet resolved)', () => {
    expect(getCompanionRosterForViewer([manager, teammate], null)).toEqual([manager, teammate]);
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
