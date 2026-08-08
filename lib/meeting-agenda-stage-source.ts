import type { SQLiteDatabase } from 'expo-sqlite';
import { getCurrentAgendaCatalog } from './meeting-agenda-catalog-source';
import {
  DEFAULT_AGENDA_POLICY_VERSION,
  DEFAULT_AGENDA_STAGE_RULES,
  computeCoveredAgendaIds,
  getVisibleAgendasForStage,
  type AgendaStageRule,
  type CycleMeetingAgendas,
} from './policies/agenda-policy';
import type { StageId } from './policies/identifiers';

/**
 * Meeting-Flow Wireframe Parity Audit 2026-08-03, item 5: resolves the
 * stage-aware, cycle-coverage-filtered agenda list for `record.tsx`'s Agenda
 * section (Wireframe-Sales-BizLink.html `#a-recordBody`'s `#a-prospectAgendaGroup`/
 * `#a-progressAgendaGroup`, lines 705-721 — driven by `aRenderRecordStage()`,
 * lines 1727-1751). `lib/policies/agenda-policy.ts::getVisibleAgendasForStage()`
 * already implements the filtering rule; no call site wired a client's real
 * catalog/stage-rules/cycle-coverage into it before this file. Follows
 * `getCurrentAgendaCatalog()`'s exact pattern (current-policy-version-scoped
 * snapshot read, DEFAULT_* fallback for first-run-offline) — no reader for
 * `agenda_stage_rules_snapshot` (populated by
 * `lib/sync/policy-sync-down.ts::pullAgendaStageRules`) existed before this.
 */

interface AgendaStageRuleSnapshotRow {
  agenda_id: string;
  policy_version: number;
  stage: string;
  is_visible: number;
}

export async function getCurrentAgendaStageRules(
  db: SQLiteDatabase,
  policyVersion: number
): Promise<AgendaStageRule[]> {
  // Mirrors getCurrentAgendaCatalog()'s fallback: policyVersion 0 is never a
  // real server version, so it's the first-run-offline signal here too.
  if (policyVersion === DEFAULT_AGENDA_POLICY_VERSION) return [...DEFAULT_AGENDA_STAGE_RULES];

  const rows = await db.getAllAsync<AgendaStageRuleSnapshotRow>(
    `SELECT agenda_id, policy_version, stage, is_visible
     FROM agenda_stage_rules_snapshot WHERE policy_version = ?`,
    [policyVersion]
  );
  if (rows.length === 0) return [...DEFAULT_AGENDA_STAGE_RULES];

  return rows.map((row) => ({
    agendaId: row.agenda_id,
    policyVersion: row.policy_version,
    stage: row.stage as AgendaStageRule['stage'],
    isVisible: row.is_visible === 1,
  }));
}

interface MeetingAgendaIdsRow {
  cycle_id: string | null;
  agenda_ids: string;
}

/**
 * `meetings.agenda_ids` (SQLite v15, populated at save time by
 * `meeting-service.ts::createMeeting()` via `mapAgendaLabelsToIds()`) already
 * stores canonical agenda ids per meeting — no label→id mapping needed here.
 */
export async function getCycleMeetingAgendas(
  db: SQLiteDatabase,
  clientId: string
): Promise<CycleMeetingAgendas[]> {
  const rows = await db.getAllAsync<MeetingAgendaIdsRow>(
    'SELECT cycle_id, agenda_ids FROM meetings WHERE client_id = ?',
    [clientId]
  );
  return rows.map((row) => ({
    cycleId: row.cycle_id,
    agendaIds: JSON.parse(row.agenda_ids || '[]'),
  }));
}

export interface VisibleAgendaLabelsInput {
  clientId: string;
  /** `Client.cycle_id` — null clients (no synced-down cycle yet) get zero covered agendas, matching a fresh cycle. */
  cycleId: string | null;
  stage: StageId;
}

/** Stage-appropriate agenda catalog entries' `displayLabel`s, ordered by `sort_order` — the exact list to feed the existing label-based agenda tile UI. */
export async function getVisibleAgendaLabelsForClient(
  db: SQLiteDatabase,
  input: VisibleAgendaLabelsInput
): Promise<string[]> {
  const { catalog, policyVersion } = await getCurrentAgendaCatalog(db);
  const stageRules = await getCurrentAgendaStageRules(db, policyVersion);
  const cycleMeetings = await getCycleMeetingAgendas(db, input.clientId);
  const coveredAgendaIds = input.cycleId ? computeCoveredAgendaIds(cycleMeetings, input.cycleId) : [];

  const visible = getVisibleAgendasForStage({
    stage: input.stage,
    policyVersion,
    catalog,
    stageRules,
    coveredAgendaIds,
  });

  return visible.map((entry) => entry.displayLabel);
}
