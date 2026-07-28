import { describe, expect, it } from 'vitest';
import {
  CLOSE_DEAL_AGENDA_ID,
  DEFAULT_AGENDA_CATALOG,
  DEFAULT_AGENDA_POLICY_VERSION,
  DEFAULT_AGENDA_STAGE_RULES,
  calculateCycleProgress,
  computeCoveredAgendaIds,
  getAgendaCatalog,
  getAgendaWeight,
  getVisibleAgendasForStage,
  isValidAgenda,
  type AgendaCatalogEntry,
} from './agenda-policy';

const ORDINARY_IDS = [
  'new_business_opportunity',
  'product_presentation',
  'price_negotiation',
  'terms_limit_negotiation',
  'relationship_building',
  'technical_support',
];

describe('DEFAULT_AGENDA_CATALOG', () => {
  it('has the 7-item v1 seed shape (6 ordinary at 15%, 1 override)', () => {
    expect(DEFAULT_AGENDA_CATALOG).toHaveLength(7);
    const ordinary = DEFAULT_AGENDA_CATALOG.filter((entry) => entry.agendaId !== CLOSE_DEAL_AGENDA_ID);
    expect(ordinary).toHaveLength(6);
    expect(ordinary.every((entry) => entry.progressWeight === 15)).toBe(true);
    const closeDeal = DEFAULT_AGENDA_CATALOG.find((entry) => entry.agendaId === CLOSE_DEAL_AGENDA_ID);
    expect(closeDeal?.progressWeight).toBe(0);
    expect(closeDeal?.progressOverride).toBe(100);
  });
});

describe('getAgendaCatalog', () => {
  it('returns only the requested policy version, sorted by sort_order', () => {
    const catalog: AgendaCatalogEntry[] = [
      { agendaId: 'b', policyVersion: 1, displayLabel: 'B', progressWeight: 15, progressOverride: null, isActive: true, sortOrder: 2 },
      { agendaId: 'a', policyVersion: 1, displayLabel: 'A', progressWeight: 15, progressOverride: null, isActive: true, sortOrder: 1 },
      { agendaId: 'stale', policyVersion: 0, displayLabel: 'Stale', progressWeight: 15, progressOverride: null, isActive: true, sortOrder: 1 },
    ];
    expect(getAgendaCatalog(catalog, 1).map((entry) => entry.agendaId)).toEqual(['a', 'b']);
  });
});

describe('isValidAgenda / getAgendaWeight', () => {
  it('validates membership and looks up weight for the bundled fallback catalog', () => {
    expect(isValidAgenda('relationship_building', DEFAULT_AGENDA_POLICY_VERSION, DEFAULT_AGENDA_CATALOG)).toBe(true);
    expect(isValidAgenda('collection', DEFAULT_AGENDA_POLICY_VERSION, DEFAULT_AGENDA_CATALOG)).toBe(false);
    expect(getAgendaWeight('relationship_building', DEFAULT_AGENDA_POLICY_VERSION, DEFAULT_AGENDA_CATALOG)).toBe(15);
    expect(getAgendaWeight(CLOSE_DEAL_AGENDA_ID, DEFAULT_AGENDA_POLICY_VERSION, DEFAULT_AGENDA_CATALOG)).toBe(0);
  });

  it('returns 0 for an unknown agenda id instead of throwing', () => {
    expect(getAgendaWeight('not_a_real_agenda', DEFAULT_AGENDA_POLICY_VERSION, DEFAULT_AGENDA_CATALOG)).toBe(0);
  });
});

describe('calculateCycleProgress', () => {
  it('sums distinct covered ordinary agenda weights, capped at 90', () => {
    const progress = calculateCycleProgress({
      stage: 'in_progress',
      coveredAgendaIds: ORDINARY_IDS,
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      catalog: DEFAULT_AGENDA_CATALOG,
    });
    // 6 * 15 = 90, exactly at the cap.
    expect(progress).toBe(90);
  });

  it('dedupes repeated agenda ids before summing', () => {
    const progress = calculateCycleProgress({
      stage: 'prospect',
      coveredAgendaIds: ['new_business_opportunity', 'new_business_opportunity', 'price_negotiation'],
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      catalog: DEFAULT_AGENDA_CATALOG,
    });
    expect(progress).toBe(30);
  });

  it('never exceeds the 90 cap even if weights would sum higher', () => {
    const catalog: AgendaCatalogEntry[] = [
      { agendaId: 'x', policyVersion: 1, displayLabel: 'X', progressWeight: 60, progressOverride: null, isActive: true, sortOrder: 1 },
      { agendaId: 'y', policyVersion: 1, displayLabel: 'Y', progressWeight: 60, progressOverride: null, isActive: true, sortOrder: 2 },
    ];
    const progress = calculateCycleProgress({
      stage: 'in_progress',
      coveredAgendaIds: ['x', 'y'],
      policyVersion: 1,
      catalog,
    });
    expect(progress).toBe(90);
  });

  it('does NOT jump to 100 merely because close_deal was recorded (mirrors the live RPC exactly — close_deal has 0 progress_weight)', () => {
    const progress = calculateCycleProgress({
      stage: 'in_progress',
      coveredAgendaIds: [CLOSE_DEAL_AGENDA_ID],
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      catalog: DEFAULT_AGENDA_CATALOG,
    });
    expect(progress).toBe(0);
  });

  it('returns 100 unconditionally once the client stage is new/existing, regardless of covered agendas', () => {
    expect(
      calculateCycleProgress({
        stage: 'new',
        coveredAgendaIds: [],
        policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
        catalog: DEFAULT_AGENDA_CATALOG,
      })
    ).toBe(100);
    expect(
      calculateCycleProgress({
        stage: 'existing',
        coveredAgendaIds: [],
        policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
        catalog: DEFAULT_AGENDA_CATALOG,
      })
    ).toBe(100);
  });
});

describe('computeCoveredAgendaIds', () => {
  it('unions distinct agenda ids from meetings scoped to the given cycle only', () => {
    const covered = computeCoveredAgendaIds(
      [
        { cycleId: 'cycle-1', agendaIds: ['a', 'b'] },
        { cycleId: 'cycle-1', agendaIds: ['b', 'c'] },
        { cycleId: 'cycle-2', agendaIds: ['z'] },
        { cycleId: null, agendaIds: ['unattached'] },
      ],
      'cycle-1'
    );
    expect(new Set(covered)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('returns an empty array when no meetings match the cycle', () => {
    expect(computeCoveredAgendaIds([{ cycleId: 'other-cycle', agendaIds: ['a'] }], 'cycle-1')).toEqual([]);
  });
});

describe('getVisibleAgendasForStage', () => {
  it('prospect shows exactly the six ordinary agendas (close_deal excluded, no stage-rule row for it)', () => {
    const visible = getVisibleAgendasForStage({
      stage: 'prospect',
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      catalog: DEFAULT_AGENDA_CATALOG,
      stageRules: DEFAULT_AGENDA_STAGE_RULES,
    });
    expect(visible.map((entry) => entry.agendaId)).toEqual(ORDINARY_IDS);
  });

  it('in_progress hides an ordinary agenda already covered this cycle but always shows close_deal', () => {
    const visible = getVisibleAgendasForStage({
      stage: 'in_progress',
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      catalog: DEFAULT_AGENDA_CATALOG,
      stageRules: DEFAULT_AGENDA_STAGE_RULES,
      coveredAgendaIds: ['new_business_opportunity', 'price_negotiation'],
    });
    const ids = visible.map((entry) => entry.agendaId);
    expect(ids).not.toContain('new_business_opportunity');
    expect(ids).not.toContain('price_negotiation');
    expect(ids).toContain('product_presentation');
    expect(ids).toContain(CLOSE_DEAL_AGENDA_ID);
  });

  it('in_progress still shows close_deal even after it has already been recorded this cycle', () => {
    const visible = getVisibleAgendasForStage({
      stage: 'in_progress',
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      catalog: DEFAULT_AGENDA_CATALOG,
      stageRules: DEFAULT_AGENDA_STAGE_RULES,
      coveredAgendaIds: [CLOSE_DEAL_AGENDA_ID],
    });
    expect(visible.map((entry) => entry.agendaId)).toContain(CLOSE_DEAL_AGENDA_ID);
  });

  it('new and existing show the six ordinary agendas regardless of stageRules content (hardcoded, not stage-rule driven)', () => {
    const visibleNew = getVisibleAgendasForStage({
      stage: 'new',
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      catalog: DEFAULT_AGENDA_CATALOG,
      stageRules: [], // deliberately empty — must not affect the result
    });
    const visibleExisting = getVisibleAgendasForStage({
      stage: 'existing',
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      catalog: DEFAULT_AGENDA_CATALOG,
      stageRules: [],
    });
    expect(visibleNew.map((entry) => entry.agendaId)).toEqual(ORDINARY_IDS);
    expect(visibleExisting.map((entry) => entry.agendaId)).toEqual(ORDINARY_IDS);
  });

  it('never surfaces Collection or Complaint resolution at any stage (not in policy v1 at all)', () => {
    for (const stage of ['prospect', 'in_progress', 'new', 'existing'] as const) {
      const visible = getVisibleAgendasForStage({
        stage,
        policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
        catalog: DEFAULT_AGENDA_CATALOG,
        stageRules: DEFAULT_AGENDA_STAGE_RULES,
      });
      expect(visible.some((entry) => entry.displayLabel === 'Collection')).toBe(false);
      expect(visible.some((entry) => entry.displayLabel === 'Complaint resolution')).toBe(false);
    }
  });

  it('excludes an inactive catalog entry from every stage', () => {
    const catalog = DEFAULT_AGENDA_CATALOG.map((entry) =>
      entry.agendaId === 'technical_support' ? { ...entry, isActive: false } : entry
    );
    const visible = getVisibleAgendasForStage({
      stage: 'prospect',
      policyVersion: DEFAULT_AGENDA_POLICY_VERSION,
      catalog,
      stageRules: DEFAULT_AGENDA_STAGE_RULES,
    });
    expect(visible.map((entry) => entry.agendaId)).not.toContain('technical_support');
  });
});
