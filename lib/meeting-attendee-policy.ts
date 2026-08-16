import type { ClientCompanionRequest } from './tag-along-service';

export interface MeetingAttendee {
  id: string;
  name: string;
  label: 'Team Manager' | 'Guest Manager';
  status: ClientCompanionRequest['status'];
}

/** Canonical local-only attendee projection. Cancelled requests never appear. */
export function classifyMeetingManagerAttendees(
  requests: readonly Pick<ClientCompanionRequest, 'id' | 'inviteeId' | 'inviteeName' | 'inviteeKind' | 'inviteeTeamId' | 'status'>[],
  viewerTeamId: string | null | undefined,
): MeetingAttendee[] {
  return requests
    .filter((request) => request.inviteeKind === 'manager' && request.status !== 'cancelled')
    .map((request) => ({
      id: request.id,
      name: request.inviteeName?.trim() || `Manager (${request.inviteeId.slice(0, 8)})`,
      label: request.inviteeTeamId && viewerTeamId && request.inviteeTeamId === viewerTeamId ? 'Team Manager' : 'Guest Manager',
      status: request.status,
    }));
}
