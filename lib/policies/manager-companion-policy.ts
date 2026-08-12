import type { TeamRosterEntry } from '../../types';
import { inviteeKindForRole } from './companion-roster-policy';
import type { CompanionSelection } from '../tag-along-service';

/** Manager recording no longer creates teammate companion requests. */
export function companionSelectionsForRecording(
  role: string | null,
  selected: readonly TeamRosterEntry[],
  visible: readonly TeamRosterEntry[]
): CompanionSelection[] {
  if (role === 'sales_manager') return [];
  return selected
    .filter((entry) => visible.some((visibleEntry) => visibleEntry.profileId === entry.profileId))
    .map((entry) => ({ profileId: entry.profileId, kind: inviteeKindForRole(entry.role) }));
}
