import { describe, expect, it } from 'vitest';
import { describeUnsyncedWork, getUnsyncedWorkCount } from './sign-out-sync-status';
import { resolveInitialDialog, resolveSyncResultDialog } from './sign-out-dialog-policy';

const ZERO = { pending: 0, syncing: 0, conflict: 0, failed: 0, synced: 9 };

describe('sign-out sync warning wording', () => {
  it('counts every state that has not safely reached the server', () => {
    expect(getUnsyncedWorkCount({ pending: 2, syncing: 1, conflict: 3, failed: 4, synced: 9 })).toBe(10);
  });

  it('explains the actionable unsynced states', () => {
    expect(describeUnsyncedWork({ pending: 2, syncing: 0, conflict: 1, failed: 0, synced: 7 }))
      .toBe('2 pending, 1 needs review');
  });
});

describe('resolveInitialDialog', () => {
  it('shows the plain confirm dialog when nothing is unsynced', () => {
    expect(resolveInitialDialog(ZERO)).toEqual({ kind: 'confirm' });
  });

  it('shows the unsynced-records warning with a description when work is pending', () => {
    expect(resolveInitialDialog({ ...ZERO, pending: 3 })).toEqual({
      kind: 'unsynced',
      description: '3 pending',
    });
  });

  it('treats syncing/conflict/failed rows as unsynced too', () => {
    expect(resolveInitialDialog({ ...ZERO, syncing: 1, conflict: 1, failed: 1 })).toEqual({
      kind: 'unsynced',
      description: '1 syncing, 1 needs review, 1 failed',
    });
  });
});

describe('resolveSyncResultDialog', () => {
  it('shows sync-complete once the outbox is empty', () => {
    expect(resolveSyncResultDialog(ZERO)).toEqual({ kind: 'sync-complete' });
  });

  it('shows sync-incomplete with a description when work remains after a sync run', () => {
    expect(resolveSyncResultDialog({ ...ZERO, failed: 2 })).toEqual({
      kind: 'sync-incomplete',
      description: '2 failed',
    });
  });
});
