import { describe, expect, it } from 'vitest';
import { formatReconnectToastMessage, shouldShowReconnectToast } from './reconnect-toast';

describe('shouldShowReconnectToast', () => {
  it('fires on a genuine offline→online reconnect that synced something', () => {
    expect(shouldShowReconnectToast('offline', 'online', 3)).toBe(true);
  });

  it('does not fire on a routine already-online pass (previous online, still online)', () => {
    expect(shouldShowReconnectToast('online', 'online', 1)).toBe(false);
  });

  it('does not fire on reconnect with nothing synced (synced === 0)', () => {
    expect(shouldShowReconnectToast('offline', 'online', 0)).toBe(false);
  });

  it('does not fire when the current pass is not online', () => {
    expect(shouldShowReconnectToast('offline', 'no_internet', 2)).toBe(false);
  });

  it('does not fire when there is no known previous state (first pass ever this session)', () => {
    expect(shouldShowReconnectToast(null, 'online', 2)).toBe(false);
  });

  it('does not fire from a non-offline degraded state (e.g. auth_required → online)', () => {
    expect(shouldShowReconnectToast('auth_required', 'online', 2)).toBe(false);
  });

  it('does not fire twice in a row: the pass immediately after a reconnect starts from previous=online', () => {
    // Simulates use-sync.ts's ref: after the reconnect pass, previousConnectivity
    // becomes 'online', so the very next routine pass must not re-fire even if it
    // also happens to sync something.
    expect(shouldShowReconnectToast('online', 'online', 5)).toBe(false);
  });
});

describe('formatReconnectToastMessage', () => {
  it('uses singular "record" for exactly 1', () => {
    expect(formatReconnectToastMessage(1)).toBe('1 record synced online.');
  });

  it('uses plural "records" for 0, 2, and higher counts', () => {
    expect(formatReconnectToastMessage(0)).toBe('0 records synced online.');
    expect(formatReconnectToastMessage(2)).toBe('2 records synced online.');
    expect(formatReconnectToastMessage(37)).toBe('37 records synced online.');
  });
});
