import type { SQLiteDatabase } from 'expo-sqlite';
import {
  DEFAULT_AGENDA_CATALOG,
  DEFAULT_AGENDA_POLICY_VERSION,
  type AgendaCatalogEntry,
} from './policies/agenda-policy';

interface AgendaCatalogSnapshotRow {
  agenda_id: string;
  policy_version: number;
  display_label: string;
  progress_weight: number;
  progress_override: number | null;
  is_active: number;
  sort_order: number;
}

/**
 * B-083 fix (2026-07-29): resolves the agenda catalog `createMeeting()` maps
 * its selected display labels against (`lib/policies/agenda-label-mapping.ts`).
 * Reads the local `agenda_catalog_snapshot` mirror (populated by
 * `lib/sync/policy-sync-down.ts`), scoped to whichever policy_version
 * `agenda_policy_versions_snapshot` marks `is_current` — falls back to the
 * bundled `DEFAULT_AGENDA_CATALOG`/`DEFAULT_AGENDA_POLICY_VERSION` only for
 * first-run-offline (before any sync-down has ever completed), matching
 * `lib/policies/agenda-policy.ts`'s own documented fallback pattern. Never
 * throws — an empty/missing snapshot is a normal first-run state, not an error.
 */
export async function getCurrentAgendaCatalog(
  db: SQLiteDatabase
): Promise<{ catalog: readonly AgendaCatalogEntry[]; policyVersion: number }> {
  const currentVersionRow = await db.getFirstAsync<{ policy_version: number }>(
    'SELECT policy_version FROM agenda_policy_versions_snapshot WHERE is_current = 1 LIMIT 1'
  );
  if (!currentVersionRow) {
    return { catalog: DEFAULT_AGENDA_CATALOG, policyVersion: DEFAULT_AGENDA_POLICY_VERSION };
  }

  const rows = await db.getAllAsync<AgendaCatalogSnapshotRow>(
    `SELECT agenda_id, policy_version, display_label, progress_weight, progress_override, is_active, sort_order
     FROM agenda_catalog_snapshot WHERE policy_version = ?`,
    [currentVersionRow.policy_version]
  );
  if (rows.length === 0) {
    return { catalog: DEFAULT_AGENDA_CATALOG, policyVersion: DEFAULT_AGENDA_POLICY_VERSION };
  }

  const catalog: AgendaCatalogEntry[] = rows.map((row) => ({
    agendaId: row.agenda_id,
    policyVersion: row.policy_version,
    displayLabel: row.display_label,
    progressWeight: row.progress_weight,
    progressOverride: row.progress_override,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
  }));

  return { catalog, policyVersion: currentVersionRow.policy_version };
}
