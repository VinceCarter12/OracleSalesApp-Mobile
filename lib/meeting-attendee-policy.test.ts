import { describe, expect, it } from 'vitest';
import { classifyMeetingManagerAttendees } from './meeting-attendee-policy';

describe('meeting attendee policy', () => {
  it('excludes cancelled/non-manager rows and labels by viewer team', () => {
    const rows = classifyMeetingManagerAttendees([
      { id: 'a', inviteeId: 'm1', inviteeName: 'Ana', inviteeKind: 'manager', inviteeTeamId: 't1', status: 'accepted' },
      { id: 'b', inviteeId: 'm2', inviteeName: null, inviteeKind: 'manager', inviteeTeamId: 't2', status: 'pending' },
      { id: 'c', inviteeId: 'm3', inviteeName: 'Cancelled', inviteeKind: 'manager', inviteeTeamId: 't1', status: 'cancelled' },
      { id: 'd', inviteeId: 's1', inviteeName: 'Sales', inviteeKind: 'teammate', inviteeTeamId: 't1', status: 'accepted' },
    ], 't1');
    expect(rows).toEqual([
      { id: 'a', name: 'Ana', label: 'Team Manager', status: 'accepted' },
      { id: 'b', name: 'Manager (m2)', label: 'Guest Manager', status: 'pending' },
    ]);
  });
});
