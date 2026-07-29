// B-083 fix (2026-07-29): `createMeeting()` only ever collects agenda
// selections as display labels (the Record Meeting picker is still
// label-based — see types/index.ts's MEETING_AGENDAS doc comment), but
// `advance_prospect_to_in_progress()` (Migration 043) joins against the
// canonical `agenda_catalog.agenda_id` via `meetings.agenda_ids`. This pure
// function bridges the two without changing the picker UI. Split out of
// `lib/policies/agenda-policy.ts` to keep that file under the 300-line cap
// (it was already at 292 lines) — additive, does not replace anything there.

import type { AgendaCatalogEntry } from './agenda-policy';

/**
 * Resolves selected display labels to their canonical `agenda_id`s for a
 * given (already-fetched) catalog. A label with no matching catalog entry is
 * dropped rather than throwing — defensive only, since the picker should
 * never offer a label outside the 7-item MEETING_AGENDAS/catalog set post-fix.
 */
export function mapAgendaLabelsToIds(
  catalog: readonly AgendaCatalogEntry[],
  selectedLabels: readonly string[]
): string[] {
  const idsByLabel = new Map(catalog.map((entry) => [entry.displayLabel, entry.agendaId]));
  const resolved: string[] = [];
  for (const label of selectedLabels) {
    const agendaId = idsByLabel.get(label);
    if (agendaId) resolved.push(agendaId);
  }
  return resolved;
}
