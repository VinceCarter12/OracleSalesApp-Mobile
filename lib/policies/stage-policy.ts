// Batch 1 (ADR-036) SCAFFOLDING — inert pre-work, no live consumer.
//
// No `stage` field exists on `Client` or `Meeting` today. The four-stage
// rail this module models (`STAGE_IDS`: prospect → in_progress → new →
// existing) mirrors an UNAPPROVED wireframe change tracked as Context.md
// item 18 — it is NOT a claim about any DB column, past or planned. `Stage`
// here is a local type mirroring the wireframe rail
// (`Wireframe-Sales-BizLink.html:1553,1826,1984`), kept isolated in this
// module until/unless that wireframe change is approved and a real consumer
// is wired up. Do not import this from any screen or hook yet.

import { STAGE_IDS, type EvidenceKind, type StageId } from './identifiers';
import { getCanonicalAgenda, CANONICAL_CLOSE_DEAL_AGENDA } from './agenda';
import type { Meeting } from '../../types';

export type Stage = StageId;

const IN_PROGRESS_INDEX = STAGE_IDS.indexOf('in_progress');

/** Forward-only, adjacent-step transitions per STAGE_IDS order. Identity transitions (current === target) are always false. */
export function canEnterStage(current: Stage, target: Stage): boolean {
  const currentIndex = STAGE_IDS.indexOf(current);
  const targetIndex = STAGE_IDS.indexOf(target);
  return targetIndex === currentIndex + 1;
}

/** 'Close deal' (canonicalized) is only valid at stage 'in_progress' or later; every other agenda is unrestricted by stage. */
export function isValidAgendaForStage(stage: Stage, agenda: string): boolean {
  const canonical = getCanonicalAgenda(agenda);
  if (canonical !== CANONICAL_CLOSE_DEAL_AGENDA) return true;
  const stageIndex = STAGE_IDS.indexOf(stage);
  return stageIndex >= IN_PROGRESS_INDEX;
}

const REQUIRED_EVIDENCE_BY_STAGE: Record<Stage, readonly EvidenceKind[]> = {
  prospect: ['gps', 'start_photo'],
  in_progress: ['gps', 'start_photo', 'end_photo', 'agenda'],
  new: ['gps', 'start_photo', 'end_photo', 'agenda', 'outcome'],
  existing: ['gps', 'start_photo', 'end_photo', 'agenda', 'outcome'],
};

export function getRequiredEvidence(stage: Stage): readonly EvidenceKind[] {
  return REQUIRED_EVIDENCE_BY_STAGE[stage];
}

/**
 * Canonicalizes BOTH the candidate agenda and each historical meeting's
 * agendas array before comparing membership — a stored 'Closed deal' must
 * match a new 'Close deal' duplicate check.
 */
export function isAgendaDuplicate(
  clientId: string,
  agenda: string,
  meetings: readonly Pick<Meeting, 'client_id' | 'agendas'>[]
): boolean {
  const canonicalAgenda = getCanonicalAgenda(agenda);
  return meetings.some(
    (meeting) =>
      meeting.client_id === clientId &&
      meeting.agendas.map(getCanonicalAgenda).includes(canonicalAgenda)
  );
}
