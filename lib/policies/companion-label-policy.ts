import type { TeamRosterEntry } from '../../types';

/** Resolve the relationship label shown beside a companion name. */
export function companionRoleLabel(entry: TeamRosterEntry, viewerTeamId: string | null): string {
  if (entry.role !== 'sales_manager') return 'Teammate';
  if (!entry.teamId || !viewerTeamId) return 'Manager';
  return entry.teamId === viewerTeamId ? 'Team Manager' : 'Guest Manager';
}
