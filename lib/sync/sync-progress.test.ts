import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSyncProgressForTests,
  beginSyncProgress,
  endSyncProgress,
  getSyncProgressPercent,
  reportSyncProgressStep,
  subscribeSyncProgress,
} from './sync-progress';

afterEach(() => {
  __resetSyncProgressForTests();
});

describe('sync-progress pub/sub', () => {
  it('notifies subscribers with the seeded total and completed=0 on begin', () => {
    const listener = vi.fn();
    subscribeSyncProgress(listener);
    beginSyncProgress(4);
    expect(listener).toHaveBeenCalledWith({ total: 4, completed: 0 });
  });

  it('increments completed by exactly 1 per reportSyncProgressStep() call', () => {
    const listener = vi.fn();
    beginSyncProgress(3);
    subscribeSyncProgress(listener);
    reportSyncProgressStep();
    reportSyncProgressStep();
    expect(listener).toHaveBeenNthCalledWith(1, { total: 3, completed: 1 });
    expect(listener).toHaveBeenNthCalledWith(2, { total: 3, completed: 2 });
  });

  it('reportSyncProgressStep() is a no-op when no pass is active', () => {
    const listener = vi.fn();
    subscribeSyncProgress(listener);
    reportSyncProgressStep();
    expect(listener).not.toHaveBeenCalled();
  });

  it('endSyncProgress() notifies subscribers with null', () => {
    const listener = vi.fn();
    beginSyncProgress(2);
    subscribeSyncProgress(listener);
    endSyncProgress();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('endSyncProgress() is safe to call even if no pass was ever begun', () => {
    const listener = vi.fn();
    subscribeSyncProgress(listener);
    expect(() => endSyncProgress()).not.toThrow();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('unsubscribe stops further notifications', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSyncProgress(listener);
    unsubscribe();
    beginSyncProgress(1);
    reportSyncProgressStep();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('getSyncProgressPercent', () => {
  it('returns 0 for a null state', () => {
    expect(getSyncProgressPercent(null)).toBe(0);
  });

  it('returns 0 for the zero-total edge case instead of NaN/Infinity', () => {
    expect(getSyncProgressPercent({ total: 0, completed: 0 })).toBe(0);
  });

  it('derives a rounded percentage from completed/total', () => {
    expect(getSyncProgressPercent({ total: 3, completed: 1 })).toBe(33);
    expect(getSyncProgressPercent({ total: 4, completed: 2 })).toBe(50);
  });

  it('caps at 100 even when completed exceeds total', () => {
    expect(getSyncProgressPercent({ total: 2, completed: 5 })).toBe(100);
  });

  it('reaches exactly 100 when completed equals total', () => {
    expect(getSyncProgressPercent({ total: 5, completed: 5 })).toBe(100);
  });
});
