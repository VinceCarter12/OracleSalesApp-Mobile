import { getDb } from './db';
import type { TeamRosterEntry, UserRole } from '../types';
export { dedupeRosterEntries, inviteeKindForRole, getCompanionRosterForViewer } from './policies/companion-roster-policy';
import { dedupeRosterEntries } from './policies/companion-roster-policy';

// ADR-030: reads the local `team_roster_snapshot` mirror (populated by
// lib/sync-down.ts::pullTeamRoster via Migration 019's team-scoped profiles
// pull) for Record Meeting's "Kasama sa visit" companion picker (relocated
// there from Complete Info as of Pass 2.5). Read-only — this module never
// writes the snapshot, only sync-down does.

interface TeamRosterRow {
  profile_id: string;
  full_name: string;
  role: string;
  team_id: string;
  is_active: number;
  avatar_url: string | null;
  synced_at: string;
}

interface ManagerDirectoryRow {
  profile_id: string;
  full_name: string;
  team_id: string | null;
  is_active: number;
  synced_at: string;
}

function rowToEntry(row: TeamRosterRow): TeamRosterEntry {
  return {
    profileId: row.profile_id,
    fullName: row.full_name,
    role: row.role as TeamRosterEntry['role'],
    teamId: row.team_id,
    isActive: row.is_active === 1,
    avatarUrl: row.avatar_url,
    syncedAt: row.synced_at,
  };
}

/**
 * Managers first, then teammates, alphabetical within each group — matches
 * the wireframe's tile ordering (Wireframe-Sales-BizLink.html `aTeamRoster`
 * demo stand-in, Decisions.md ADR-030 decision 2). Empty array means the
 * roster hasn't synced yet (or the agent has no team) — callers show the
 * offline-helper text and keep the section fully skippable.
 */
export async function getTeamRoster(
  profileId: string | null,
  teamId: string | null,
  viewerRole: UserRole | null,
): Promise<TeamRosterEntry[]> {
  const allowedViewer = viewerRole === 'sales_manager' || viewerRole === 'sales_specialist' || viewerRole === 'rsr';
  if (!profileId || !teamId || !allowedViewer) return [];
  const db = await getDb();
  // Sales/RSR receives the company-wide manager directory through its
  // restricted sync RPC, while peer teammates remain team-scoped. Managers
  // continue to read only the team roster (and are blocked from selecting
  // another manager by the companion policy).
  if (viewerRole === 'sales_specialist' || viewerRole === 'rsr') {
    const [managerRows, teammateRows] = await Promise.all([
      db.getAllAsync<ManagerDirectoryRow>(
        `SELECT profile_id, full_name, team_id, is_active, synced_at
           FROM manager_directory_snapshot
          WHERE profile_id != ? AND is_active = 1
          ORDER BY full_name COLLATE NOCASE`,
        [profileId],
      ),
      db.getAllAsync<TeamRosterRow>(
        `SELECT profile_id, full_name, role, team_id, is_active, avatar_url, synced_at
           FROM team_roster_snapshot
          WHERE profile_id != ? AND team_id = ? AND is_active = 1
            AND role IN ('sales_specialist', 'rsr')
          ORDER BY full_name COLLATE NOCASE`,
        [profileId, teamId],
      ),
    ]);
    const combined = [
      ...managerRows.map((row): TeamRosterEntry => ({
        profileId: row.profile_id,
        fullName: row.full_name,
        role: 'sales_manager',
        teamId: row.team_id ?? '',
        isActive: row.is_active === 1,
        avatarUrl: null,
        syncedAt: row.synced_at,
      })),
      ...teammateRows.map(rowToEntry),
    ];
    return dedupeRosterEntries(combined).sort((a, b) => {
      const roleOrder = a.role === 'sales_manager' ? 0 : 1;
      const otherRoleOrder = b.role === 'sales_manager' ? 0 : 1;
      return roleOrder - otherRoleOrder || a.fullName.localeCompare(b.fullName);
    });
  }

  const rows = await db.getAllAsync<TeamRosterRow>(
    `SELECT profile_id, full_name, role, team_id, is_active, avatar_url, synced_at
       FROM team_roster_snapshot
      WHERE profile_id != ? AND team_id = ? AND is_active = 1
        AND role IN ('sales_manager', 'sales_specialist', 'rsr')
      ORDER BY CASE role WHEN 'sales_manager' THEN 0 ELSE 1 END, full_name COLLATE NOCASE`,
    [profileId, teamId]
  );
  return rows.map(rowToEntry);
}

