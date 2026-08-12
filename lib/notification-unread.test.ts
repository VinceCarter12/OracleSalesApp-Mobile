import { describe, expect, it } from 'vitest';
import { pruneNotificationPresentationState } from './notification-unread';

describe('notification presentation retention', () => {
  it('moves read notifications older than seven days to local cleared state', () => {
    const now = Date.parse('2026-08-12T00:00:00.000Z');
    const state = pruneNotificationPresentationState({
      readAt: { old: '2026-08-04T23:59:59.000Z', fresh: '2026-08-05T00:00:01.000Z' },
      archived: ['old'],
      cleared: [],
    }, now);
    expect(state.readAt).toEqual({ fresh: '2026-08-05T00:00:01.000Z' });
    expect(state.archived).toEqual([]);
    expect(state.cleared).toEqual(['old']);
  });

  it('preserves unread, archived, and already-cleared ids', () => {
    const now = Date.parse('2026-08-12T00:00:00.000Z');
    const state = pruneNotificationPresentationState({ readAt: { old: '2026-08-04T00:00:00.000Z' }, archived: ['active-archive'], cleared: ['already-cleared'] }, now);
    expect(state.cleared).toEqual(['already-cleared', 'old']);
    expect(state.archived).toEqual(['active-archive']);
  });
});
