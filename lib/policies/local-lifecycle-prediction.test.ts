import { describe, expect, it } from 'vitest';
import { predictsProspectToInProgress } from './local-lifecycle-prediction';

const VALID_IDS = new Set(['agenda-close-deal', 'agenda-presentation']);

describe('predictsProspectToInProgress', () => {
  it('predicts promotion for prospect + Successful + a valid catalog agenda + no pending tag-along', () => {
    expect(
      predictsProspectToInProgress({
        currentStatus: 'prospect',
        outcome: 'Successful',
        agendaIds: ['agenda-close-deal'],
        validCatalogAgendaIds: VALID_IDS,
        hasPendingManagerTagAlong: false,
      })
    ).toBe(true);
  });

  it('does not predict promotion when a manager tag-along is pending', () => {
    expect(
      predictsProspectToInProgress({
        currentStatus: 'prospect',
        outcome: 'Successful',
        agendaIds: ['agenda-close-deal'],
        validCatalogAgendaIds: VALID_IDS,
        hasPendingManagerTagAlong: true,
      })
    ).toBe(false);
  });

  it('does not predict promotion for a non-Successful outcome', () => {
    for (const outcome of ['Follow-up Required', 'No Decision', 'Lost Opportunity'] as const) {
      expect(
        predictsProspectToInProgress({
          currentStatus: 'prospect',
          outcome,
          agendaIds: ['agenda-close-deal'],
          validCatalogAgendaIds: VALID_IDS,
          hasPendingManagerTagAlong: false,
        })
      ).toBe(false);
    }
  });

  it('does not predict promotion with a null outcome (fast path never collects one)', () => {
    expect(
      predictsProspectToInProgress({
        currentStatus: 'prospect',
        outcome: null,
        agendaIds: ['agenda-close-deal'],
        validCatalogAgendaIds: VALID_IDS,
        hasPendingManagerTagAlong: false,
      })
    ).toBe(false);
  });

  it('does not predict promotion when no selected agenda is in the current catalog', () => {
    expect(
      predictsProspectToInProgress({
        currentStatus: 'prospect',
        outcome: 'Successful',
        agendaIds: ['agenda-not-in-catalog'],
        validCatalogAgendaIds: VALID_IDS,
        hasPendingManagerTagAlong: false,
      })
    ).toBe(false);
  });

  it('does not predict promotion with zero agendas selected', () => {
    expect(
      predictsProspectToInProgress({
        currentStatus: 'prospect',
        outcome: 'Successful',
        agendaIds: [],
        validCatalogAgendaIds: VALID_IDS,
        hasPendingManagerTagAlong: false,
      })
    ).toBe(false);
  });

  it('does not predict promotion for clients already in_progress/new/existing', () => {
    for (const currentStatus of ['in_progress', 'new', 'existing', 'inactive'] as const) {
      expect(
        predictsProspectToInProgress({
          currentStatus,
          outcome: 'Successful',
          agendaIds: ['agenda-close-deal'],
          validCatalogAgendaIds: VALID_IDS,
          hasPendingManagerTagAlong: false,
        })
      ).toBe(false);
    }
  });

  it('predicts promotion when at least one selected agenda is valid, even alongside an invalid one', () => {
    expect(
      predictsProspectToInProgress({
        currentStatus: 'prospect',
        outcome: 'Successful',
        agendaIds: ['agenda-not-in-catalog', 'agenda-presentation'],
        validCatalogAgendaIds: VALID_IDS,
        hasPendingManagerTagAlong: false,
      })
    ).toBe(true);
  });
});
