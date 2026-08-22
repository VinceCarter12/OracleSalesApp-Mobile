// ADR-045 (Batch 3): versioned, per-cycle-pinned agenda-policy system.
// Establishes `lib/policies/` module #6 alongside stage-policy.ts/agenda.ts/
// quota-policy.ts/approval-policy.ts/meeting-session-policy.ts/
// identifiers.ts — additive, does NOT replace or modify any of those.
//
// Pure TypeScript, no I/O (matches every other file in this directory).
// Callers own fetching rows from the SQLite v14 snapshot tables
// (agenda_catalog_snapshot / agenda_policy_versions_snapshot /
// agenda_stage_rules_snapshot, lib/db.ts) or substituting the bundled
// DEFAULT_* fallback below for first-run-offline, and pass the resolved
// arrays in — this module never resolves a client's pinned
// `agenda_policy_version` itself (see the client_cycles RLS gap noted in
// lib/sync/policy-sync-down.ts, which is exactly why that resolution can't
// safely live here yet).
//
// Retirement note (ADR-045 decision #1): this module does NOT replace
// lib/client-progress.ts's getClientProgress()/getClientProgressBreakdown()
// in this slice — see Batch 3 Slice 3 handoff notes for why call-site
// migration is deferred.

import { type StageId } from './identifiers';

/** Stable ids only — never a display label (hard project constraint). */
export interface AgendaCatalogEntry {
  agendaId: string;
  policyVersion: number;
  displayLabel: string;
  progressWeight: number;
  progressOverride: number | null;
  isActive: boolean;
  sortOrder: number;
}

// Migration 038 Part D's live CHECK constraint only allows these two values
// for `agenda_stage_rules.stage` (Migration-038-Report.md line 203) —
// 'new'/'existing' deliberately never get stage-rule rows (ADR-046 #5).
export type AgendaStageRuleStage = Extract<StageId, 'prospect' | 'in_progress'>;

export interface AgendaStageRule {
  agendaId: string;
  policyVersion: number;
  stage: AgendaStageRuleStage;
  isVisible: boolean;
}

/** A single cycle-scoped meeting's contribution to "which agendas has this cycle already covered." */
export interface CycleMeetingAgendas {
  cycleId: string | null;
  agendaIds: readonly string[];
}

export const CLOSE_DEAL_AGENDA_ID = 'close_deal';

// get_client_cycle_progress() (Migration-038-Report.md lines 240-258) caps
// the prospect/in_progress branch at 90 — never derive a different cap.
const PROGRESS_CAP = 90;

// Migration-038-Report.md line 244: `when c.customer_type in ('new',
// 'existing') then 100`. Mirrored here verbatim as the stage bypass.
const STAGES_AT_FULL_PROGRESS: ReadonlySet<StageId> = new Set<StageId>(['new', 'existing']);

/**
 * Bundled fallback for first-run-offline, before any sync-down has ever
 * completed (ADR-045 decision #6). `policyVersion: 0` is deliberately never
 * a real server policy_version (those start at 1) so a bug that
 * accidentally left this fallback wired past first sync is detectable.
 *
 * Values are Vince's final 7-item v1 seed, copied verbatim from
 * Migration-038-Report.md lines 223-230 (agenda_id, display_label,
 * progress_weight, progress_override, sort_order) — do not hand-derive.
 */
export const DEFAULT_AGENDA_POLICY_VERSION = 0;

export const DEFAULT_AGENDA_CATALOG: readonly AgendaCatalogEntry[] = [
  {
    agendaId: 'new_business_opportunity',
    policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
    displayLabel: 'New business opportunity',
    progressWeight: 15,
    progressOverride: null,
    isActive: true,
    sortOrder: 1,
  },
  {
    agendaId: 'product_presentation',
    policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
    displayLabel: 'Product / company presentation',
    progressWeight: 15,
    progressOverride: null,
    isActive: true,
    sortOrder: 2,
  },
  {
    agendaId: 'price_negotiation',
    policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
    displayLabel: 'Price negotiation / quotation',
    progressWeight: 15,
    progressOverride: null,
    isActive: true,
    sortOrder: 3,
  },
  {
    agendaId: 'terms_limit_negotiation',
    policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
    displayLabel: 'Terms & limit negotiation',
    progressWeight: 15,
    progressOverride: null,
    isActive: true,
    sortOrder: 4,
  },
  {
    agendaId: 'relationship_building',
    policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
    displayLabel: 'Relationship building',
    progressWeight: 15,
    progressOverride: null,
    isActive: true,
    sortOrder: 5,
  },
  {
    agendaId: 'technical_support',
    policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
    displayLabel: 'Technical support',
    progressWeight: 15,
    progressOverride: null,
    isActive: true,
    sortOrder: 6,
  },
  {
    agendaId: CLOSE_DEAL_AGENDA_ID,
    policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
    displayLabel: 'Close deal',
    progressWeight: 0,
    progressOverride: 100,
    isActive: true,
    sortOrder: 7,
  },
];

/**
 * ADR-061 (Vince, 2026-08-19/20): Close deal is now available at the
 * prospect stage — a prospect may attach PO evidence directly (Scenario 1:
 * prospect + Close deal + PO -> manager approval -> new), optional at this
 * stage. Previously this filtered CLOSE_DEAL_AGENDA_ID out of prospect
 * entirely; both stages now carry the full catalog. Mirrored server-side by
 * Web migration 109's `agenda_stage_rules` update (supersedes migration
 * 038's original seed, which this constant's old comment described).
 */
export const DEFAULT_AGENDA_STAGE_RULES: readonly AgendaStageRule[] = [
  ...DEFAULT_AGENDA_CATALOG.map(
    (entry): AgendaStageRule => ({
      agendaId: entry.agendaId,
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      stage: 'prospect',
      isVisible: true,
    })
  ),
  ...DEFAULT_AGENDA_CATALOG.map(
    (entry): AgendaStageRule => ({
      agendaId: entry.agendaId,
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      stage: 'in_progress',
      isVisible: true,
    })
  ),
];

/** Catalog entries for a policy version, ordered by `sort_order` (matches `agenda_catalog.sort_order`, never display-label order). */
export function getAgendaCatalog(
  catalog: readonly AgendaCatalogEntry[],
  policyVersion: number
): AgendaCatalogEntry[] {
  return catalog
    .filter((entry) => entry.policyVersion === policyVersion)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Whether `agendaId` exists in the catalog for `policyVersion` — the only valid identity check (never compare against a display label). */
export function isValidAgenda(
  agendaId: string,
  policyVersion: number,
  catalog: readonly AgendaCatalogEntry[]
): boolean {
  return catalog.some((entry) => entry.policyVersion === policyVersion && entry.agendaId === agendaId);
}

/** `progress_weight` for an agenda at a policy version; 0 for an unknown/inactive-for-this-version agenda (safe default, never throws). */
export function getAgendaWeight(
  agendaId: string,
  policyVersion: number,
  catalog: readonly AgendaCatalogEntry[]
): number {
  return catalog.find((entry) => entry.policyVersion === policyVersion && entry.agendaId === agendaId)?.progressWeight ?? 0;
}

/**
 * Mirrors `get_client_cycle_progress()` EXACTLY (Migration-038-Report.md
 * lines 240-258) — do not "improve" this with an override lookup. The live
 * RPC sums only `progress_weight` for distinct covered agenda ids, capped at
 * 90, for any stage not already 'new'/'existing'; it never consults
 * `agenda_catalog.progress_override` (that column is unused by this RPC —
 * `close_deal`'s 0-weight means recording it alone contributes nothing to
 * this capped preview; the jump to 100 only happens once the client's own
 * stage/status actually flips to 'new', which is a separate server
 * transition, not something this function can or should simulate). This
 * mismatch between the ADR's prose ("override to 100 on close_deal") and
 * the literal live SQL was found while implementing this module — flagged
 * to Vince, not silently resolved either way; this function follows the
 * literal SQL per this slice's explicit instruction to mirror it exactly.
 */
export function calculateCycleProgress(input: {
  stage: StageId;
  coveredAgendaIds: readonly string[];
  policyVersion: number;
  catalog: readonly AgendaCatalogEntry[];
}): number {
  const { stage, coveredAgendaIds, policyVersion, catalog } = input;
  if (STAGES_AT_FULL_PROGRESS.has(stage)) return 100;

  const distinctCovered = new Set(coveredAgendaIds);
  let total = 0;
  for (const agendaId of distinctCovered) {
    total += getAgendaWeight(agendaId, policyVersion, catalog);
  }
  return Math.min(total, PROGRESS_CAP);
}

/**
 * Which agenda ids has this cycle already covered, from its own meetings'
 * `agenda_ids` — pure computation over already-fetched local data (no new
 * sync call). Meetings whose `cycleId` doesn't match `cycleId` (including a
 * previous owner/cycle's late-arriving meeting, or a meeting the
 * `stamp_meeting_cycle` trigger never attached to a cycle at all) are
 * permanently excluded, matching Migration 038's cycle-scoped eligibility
 * rule (Migration-038-Report.md line 54: "Late-arriving meetings from a
 * previous cycle cannot affect the current cycle").
 */
export function computeCoveredAgendaIds(meetings: readonly CycleMeetingAgendas[], cycleId: string): string[] {
  const covered = new Set<string>();
  for (const meeting of meetings) {
    if (meeting.cycleId !== cycleId) continue;
    for (const agendaId of meeting.agendaIds) covered.add(agendaId);
  }
  return Array.from(covered);
}

function hasVisibleStageRule(
  stageRules: readonly AgendaStageRule[],
  agendaId: string,
  policyVersion: number,
  stage: AgendaStageRuleStage
): boolean {
  return stageRules.some(
    (rule) =>
      rule.policyVersion === policyVersion && rule.agendaId === agendaId && rule.stage === stage && rule.isVisible
  );
}

/**
 * Visible agenda catalog per stage (ADR-046 #5, correction addendum
 * unaffected — this is unrelated to the tag-along gate scope):
 * - prospect: the six ordinary agendas (per stage-rule rows; `close_deal`
 *   has none for 'prospect' in the live seed, so it's naturally excluded).
 * - in_progress: ordinary agendas NOT YET covered this cycle, plus
 *   `close_deal` which "remains visible" unconditionally (ADR-046 #2) —
 *   never filtered by coverage, unlike the ordinary agendas.
 * - new/existing: the six ordinary agendas, HARDCODED (not stage-rule
 *   driven — Migration 038's `agenda_stage_rules_stage_check` CHECK
 *   constraint only allows 'prospect'/'in_progress', so no rows can ever
 *   exist for these two stages; `stageRules` is intentionally unused here).
 *   `Collection`/`Complaint resolution` are not in policy v1's catalog at
 *   all, so they can never appear regardless of stage (ADR-046 #5).
 */
export function getVisibleAgendasForStage(input: {
  stage: StageId;
  policyVersion: number;
  catalog: readonly AgendaCatalogEntry[];
  stageRules: readonly AgendaStageRule[];
  coveredAgendaIds?: readonly string[];
}): AgendaCatalogEntry[] {
  const { stage, policyVersion, catalog, stageRules } = input;
  const coveredAgendaIds = input.coveredAgendaIds ?? [];
  const versionCatalog = getAgendaCatalog(catalog, policyVersion).filter((entry) => entry.isActive);

  if (stage === 'new' || stage === 'existing') {
    return versionCatalog.filter((entry) => entry.agendaId !== CLOSE_DEAL_AGENDA_ID);
  }

  const stageRuleStage: AgendaStageRuleStage = stage === 'in_progress' ? 'in_progress' : 'prospect';
  const covered = new Set(coveredAgendaIds);

  return versionCatalog.filter((entry) => {
    if (!hasVisibleStageRule(stageRules, entry.agendaId, policyVersion, stageRuleStage)) return false;
    if (stageRuleStage === 'in_progress' && entry.agendaId !== CLOSE_DEAL_AGENDA_ID && covered.has(entry.agendaId)) {
      return false;
    }
    return true;
  });
}
