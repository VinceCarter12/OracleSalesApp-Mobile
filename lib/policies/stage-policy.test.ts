import { describe, expect, it } from 'vitest';
import { canEnterStage, isAgendaDuplicate } from './stage-policy';
import type { Meeting } from '../../types';

describe('canEnterStage', () => {
  it('allows forward-only adjacent transitions', () => {
    expect(canEnterStage('prospect', 'in_progress')).toBe(true);
    expect(canEnterStage('in_progress', 'new')).toBe(true);
    expect(canEnterStage('new', 'existing')).toBe(true);
  });

  it('rejects a skipped-step transition', () => {
    expect(canEnterStage('prospect', 'new')).toBe(false);
    expect(canEnterStage('prospect', 'existing')).toBe(false);
  });

  it('rejects a backward transition', () => {
    expect(canEnterStage('existing', 'new')).toBe(false);
    expect(canEnterStage('in_progress', 'prospect')).toBe(false);
  });

  it('rejects an identity transition', () => {
    expect(canEnterStage('prospect', 'prospect')).toBe(false);
  });
});

describe('isAgendaDuplicate', () => {
  const meetings: Pick<Meeting, 'client_id' | 'agendas'>[] = [
    { client_id: 'client-1', agendas: ['Relationship building', 'Closed deal'] },
    { client_id: 'client-2', agendas: ['Collection'] },
  ];

  it('matches a stored legacy "Closed deal" against a new canonical "Close deal" check', () => {
    expect(isAgendaDuplicate('client-1', 'Close deal', meetings)).toBe(true);
  });

  it('matches a stored legacy label against a new legacy-labeled check too', () => {
    expect(isAgendaDuplicate('client-1', 'Closed deal', meetings)).toBe(true);
  });

  it('returns false when the client has no matching agenda', () => {
    expect(isAgendaDuplicate('client-2', 'Close deal', meetings)).toBe(false);
  });

  it('returns false when the client has no meetings at all', () => {
    expect(isAgendaDuplicate('client-3', 'Close deal', meetings)).toBe(false);
  });
});
