import type { TeamRosterEntry, UserRole } from '../../types';

// Split out of lib/team-roster.ts (pure logic only, no `getDb()`/expo-sqlite
// import) so it stays testable under the repo's node-only vitest config —
// importing team-roster.ts directly pulls in expo-sqlite -> react-native's
// Flow-syntax entry point, which the test runner can't parse. team-roster.ts
// re-exports both functions so its own public API/call sites stay unchanged.

/** `invitee_kind` derivation shared by the picker UI and its save path (ADR-030 decision 2). */
export function inviteeKindForRole(role: TeamRosterEntry['role']): 'manager' | 'teammate' {
  return role === 'sales_manager' ? 'manager' : 'teammate';
}

/**
 * ADR-046 decision 4 / correction addendum: a Manager's own meeting form
 * must never expose another Manager as a selectable companion — Manager-
 * owned companion rows always insert pre-accepted (F-205 decision 2), so a
 * manager tile here would silently create a pending `invitee_kind='manager'`
 * request against the Manager's own meeting with no counterpart able to
 * approve it. `getTeamRoster()`'s own `.neq('id', profileId)` scope already
 * excludes the viewer themselves in the common one-manager-per-team case;
 * this filter is the explicit, defensive UI-level guarantee for the
 * (explicitly out-of-scope per ADR-046 #4) multi-manager-per-team edge case,
 * matching the wireframe's `managerRenderCompanions` (Wireframe-Manager-
 * BizLink.html), which only ever renders teammate tiles for a Manager's own
 * recording flow.
 *
 * A non-manager (Sales/RSR) viewer's roster is filtered down to Managers
 * only — the teammate-as-companion option was removed 2026-08-09 (Vince):
 * Sales/RSR agents may only tag along their manager, never a peer.
 */
export function getCompanionRosterForViewer(
  roster: TeamRosterEntry[],
  viewerRole: UserRole | null,
  viewerTeamId: string | null,
): TeamRosterEntry[] {
  if (viewerRole === null || viewerTeamId === null) return [];
  const activeRoster = roster.filter((entry) => entry.isActive && entry.teamId === viewerTeamId);
  if (viewerRole === 'sales_manager') return activeRoster.filter((entry) => entry.role !== 'sales_manager');
  if (viewerRole === 'sales_specialist' || viewerRole === 'rsr') {
    return activeRoster.filter((entry) => entry.role === 'sales_manager');
  }
  return [];
}
