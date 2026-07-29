import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENDA_CATALOG, CLOSE_DEAL_AGENDA_ID } from './agenda-policy';
import { mapAgendaLabelsToIds } from './agenda-label-mapping';

// B-083 fix: this is the mapping step that was entirely missing from
// createMeeting() — without it, agenda_ids stayed empty and
// advance_prospect_to_in_progress() could never match anything.
describe('mapAgendaLabelsToIds', () => {
  it('maps each selected display label to its canonical agenda_id, preserving order', () => {
    const result = mapAgendaLabelsToIds(DEFAULT_AGENDA_CATALOG, [
      'Relationship building',
      'Close deal',
    ]);
    expect(result).toEqual(['relationship_building', CLOSE_DEAL_AGENDA_ID]);
  });

  it('maps all 7 live-seed labels correctly (full picker selection)', () => {
    const allLabels = DEFAULT_AGENDA_CATALOG.map((entry) => entry.displayLabel);
    const result = mapAgendaLabelsToIds(DEFAULT_AGENDA_CATALOG, allLabels);
    expect(result).toEqual(DEFAULT_AGENDA_CATALOG.map((entry) => entry.agendaId));
  });

  it('drops a label with no matching catalog entry instead of throwing (defensive-only path)', () => {
    const result = mapAgendaLabelsToIds(DEFAULT_AGENDA_CATALOG, ['Collection', 'Close deal']);
    expect(result).toEqual([CLOSE_DEAL_AGENDA_ID]);
  });

  it('returns an empty array for an empty selection', () => {
    expect(mapAgendaLabelsToIds(DEFAULT_AGENDA_CATALOG, [])).toEqual([]);
  });
});
