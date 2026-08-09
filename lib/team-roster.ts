import { getDb } from './db';
import type { TeamRosterEntry, UserRole } from '../types';
export { inviteeKindForRole, getCompanionRosterForViewer } from './policies/companion-roster-policy';

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
  const rows = await db.getAllAsync<TeamRosterRow>(
    `SELECT profile_id, full_name, role, team_id, is_active, avatar_url, synced_at
       FROM team_roster_snapshot
      WHERE profile_id != ? AND team_id = ? AND is_active = 1
        AND role IN ('sales_manager', 'sales_specialist', 'rsr')
        AND role != 'admin' AND role != 'superadmin'
      ORDER BY CASE role WHEN 'sales_manager' THEN 0 ELSE 1 END, full_name COLLATE NOCASE`,
    [profileId, teamId]
  );
  return rows.map(rowToEntry);
}

