import { hasOtherActiveDraftForAgent } from './meeting-drafts';

export type MeetingStartGuardResult =
  | { allowed: true }
  | { allowed: false; reason: 'ongoing_meeting' | 'unavailable' };

/**
 * Shared fail-closed preflight for every Start meeting entry point. The
 * durable write in `saveDraft()` repeats the check to close the race between
 * two screens; this preflight simply lets the user see the warning before GPS
 * capture and the Start confirmation dialog.
 */
export async function checkMeetingStartAllowed(
  agentId: string | null,
  clientId: string | undefined
): Promise<MeetingStartGuardResult> {
  if (!agentId || !clientId) return { allowed: false, reason: 'unavailable' };
  try {
    return (await hasOtherActiveDraftForAgent(agentId, clientId))
      ? { allowed: false, reason: 'ongoing_meeting' }
      : { allowed: true };
  } catch (error) {
    console.error('[meeting-ongoing-guard] Unable to verify active meeting:', error);
    return { allowed: false, reason: 'unavailable' };
  }
}
