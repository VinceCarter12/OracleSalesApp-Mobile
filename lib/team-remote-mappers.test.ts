import { describe, expect, it } from 'vitest';
import { buildTeamAgents, clientStatusLabel } from './team-remote-mappers';
import { CLIENT_STATUSES } from '../types';

describe('clientStatusLabel', () => {
  it('title-cases the simple single-word statuses', () => {
    expect(clientStatusLabel('prospect')).toBe('Prospect');
    expect(clientStatusLabel('new')).toBe('New');
    expect(clientStatusLabel('existing')).toBe('Existing');
    expect(clientStatusLabel('inactive')).toBe('Inactive');
  });

  // ADR-042: a naive charAt-capitalize would render this as "In_progress" —
  // must be an explicit "In Progress" label instead.
  it('renders in_progress as "In Progress", not "In_progress"', () => {
    expect(clientStatusLabel('in_progress')).toBe('In Progress');
  });

  it('has a label for every value in CLIENT_STATUSES', () => {
    for (const status of CLIENT_STATUSES) {
      expect(clientStatusLabel(status).length).toBeGreaterThan(0);
    }
  });
});

// B-055 regression: agents must be keyed/joined by `profiles.id` (the
// canonical ownership identity, ADR-023), never `profiles.user_id`. This
// mirrors the shape both lib/manager-dashboard-service.ts and
// lib/manager-team-service.ts now pass in — `id` here IS profiles.id.
describe('buildTeamAgents', () => {
  const now = new Date('2026-08-01T00:00:00.000Z');

  it('keys, joins, and counts agents by profiles.id, not any other identifier', () => {
    const profiles = [{ id: 'profile-1', full_name: 'Juan Dela Cruz' }];
    const clients = [{ assigned_agent_id: 'profile-1' }, { assigned_agent_id: 'profile-1' }];
    const meetings = [
      { agent_id: 'profile-1', outcome: 'successful', meeting_date: '2026-08-01T10:00:00.000Z' },
      { agent_id: 'profile-1', outcome: null, meeting_date: '2026-08-01T11:00:00.000Z' },
      // Different agent id — must NOT be attributed to profile-1.
      { agent_id: 'profile-2', outcome: 'successful', meeting_date: '2026-08-01T12:00:00.000Z' },
    ];

    const agents = buildTeamAgents(profiles, clients, meetings, now);

    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('profile-1');
    expect(agents[0].activeClients).toBe(2);
    expect(agents[0].meetingsThisMonth).toBe(2);
    expect(agents[0].successRate).toBe(50);
  });

  it('produces an empty roster when no profile rows are supplied', () => {
    expect(buildTeamAgents([], [], [], now)).toEqual([]);
  });
});
