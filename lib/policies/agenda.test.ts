import { describe, expect, it } from 'vitest';
import {
  CANONICAL_CLOSE_DEAL_AGENDA,
  LEGACY_CLOSED_DEAL_AGENDA,
  getCanonicalAgenda,
  getCanonicalAgendas,
  isKnownAgenda,
} from './agenda';

describe('getCanonicalAgenda', () => {
  it('maps the legacy label to the canonical label', () => {
    expect(getCanonicalAgenda(LEGACY_CLOSED_DEAL_AGENDA)).toBe(CANONICAL_CLOSE_DEAL_AGENDA);
  });

  it('passes the canonical label through unchanged', () => {
    expect(getCanonicalAgenda(CANONICAL_CLOSE_DEAL_AGENDA)).toBe(CANONICAL_CLOSE_DEAL_AGENDA);
  });

  it('passes an unknown label through unchanged', () => {
    expect(getCanonicalAgenda('Some unrelated label')).toBe('Some unrelated label');
  });
});

describe('getCanonicalAgendas', () => {
  it('maps getCanonicalAgenda over every entry', () => {
    expect(getCanonicalAgendas(['Relationship building', LEGACY_CLOSED_DEAL_AGENDA])).toEqual([
      'Relationship building',
      CANONICAL_CLOSE_DEAL_AGENDA,
    ]);
  });
});

describe('isKnownAgenda', () => {
  it('returns true for a real agenda label', () => {
    expect(isKnownAgenda('Relationship building')).toBe(true);
  });

  it('returns false for an unknown label', () => {
    expect(isKnownAgenda('Not a real agenda')).toBe(false);
  });
});
