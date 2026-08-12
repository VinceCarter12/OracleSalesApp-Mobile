import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hasOtherActiveDraftForAgent } = vi.hoisted(() => ({
  hasOtherActiveDraftForAgent: vi.fn(),
}));

vi.mock('./meeting-drafts', () => ({ hasOtherActiveDraftForAgent }));

import { checkMeetingStartAllowed } from './meeting-ongoing-guard';

describe('checkMeetingStartAllowed', () => {
  beforeEach(() => {
    hasOtherActiveDraftForAgent.mockReset();
  });

  it('allows a Start only when the agent has no other active draft', async () => {
    hasOtherActiveDraftForAgent.mockResolvedValue(false);
    await expect(checkMeetingStartAllowed('agent-1', 'client-1')).resolves.toEqual({ allowed: true });
    expect(hasOtherActiveDraftForAgent).toHaveBeenCalledWith('agent-1', 'client-1');
  });

  it('blocks a second meeting with the ongoing-meeting reason', async () => {
    hasOtherActiveDraftForAgent.mockResolvedValue(true);
    await expect(checkMeetingStartAllowed('agent-1', 'client-2')).resolves.toEqual({ allowed: false, reason: 'ongoing_meeting' });
  });

  it('fails closed if local draft state cannot be read', async () => {
    hasOtherActiveDraftForAgent.mockRejectedValue(new Error('SQLite unavailable'));
    await expect(checkMeetingStartAllowed('agent-1', 'client-1')).resolves.toEqual({ allowed: false, reason: 'unavailable' });
  });
});
