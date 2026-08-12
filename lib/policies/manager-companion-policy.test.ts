import { describe, expect, it } from 'vitest';
import { companionSelectionsForRecording } from './manager-companion-policy';
import type { TeamRosterEntry } from '../../types';

const teammate: TeamRosterEntry = { profileId: 't-1', fullName: 'Teammate', role: 'sales_specialist', teamId: 'team-1', isActive: true, avatarUrl: null, syncedAt: '2026-08-12T00:00:00Z' };

describe('companionSelectionsForRecording', () => {
  it('blocks Manager-created companion requests', () => {
    expect(companionSelectionsForRecording('sales_manager', [teammate], [teammate])).toEqual([]);
  });

  it('keeps Sales companion selections available', () => {
    expect(companionSelectionsForRecording('sales_specialist', [teammate], [teammate])).toEqual([
      { profileId: 't-1', kind: 'teammate' },
    ]);
  });
});
