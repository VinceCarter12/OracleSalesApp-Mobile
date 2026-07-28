import { describe, expect, it } from 'vitest';
import { CLIENT_STATUS_BADGES } from './client-status';

describe('CLIENT_STATUS_BADGES', () => {
  // ADR-042 (2026-07-27): 'in_progress' badge reuses the app's existing
  // amber/orange "in-progress-ish" pairing (already established for
  // WAITING_MANAGER_APPROVAL_BADGE and the 'Follow-up Required' outcome
  // badge) rather than inventing a new hex value — this pins that choice so
  // a future edit doesn't silently drift back toward inventing a new tint.
  it('gives in_progress its own amber/orange tone, distinct from prospect/new/existing', () => {
    const inProgress = CLIENT_STATUS_BADGES.in_progress;
    expect(inProgress.label).toBe('IN PROGRESS');
    expect(inProgress.background).not.toBe(CLIENT_STATUS_BADGES.prospect.background);
    expect(inProgress.background).not.toBe(CLIENT_STATUS_BADGES.new.background);
    expect(inProgress.background).not.toBe(CLIENT_STATUS_BADGES.existing.background);
  });
});
