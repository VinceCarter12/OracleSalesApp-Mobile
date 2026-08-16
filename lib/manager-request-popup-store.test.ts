import { beforeEach, describe, expect, it } from 'vitest';
import { getPoppedRequestIds, markRequestsPopped, resetPoppedRequestIds } from './manager-request-popup-store';

// 2026-08-16 (Vince direct feedback): rewritten for the in-memory-only
// contract — the old permanent expo-secure-store watermark is gone
// entirely, so this file no longer mocks expo-secure-store.
describe('manager-request-popup-store (in-memory, per-session watermark)', () => {
  beforeEach(() => {
    resetPoppedRequestIds();
  });

  it('starts empty', () => {
    expect(getPoppedRequestIds()).toEqual(new Set());
  });

  it('marks a request id as popped so it is retrievable afterward', () => {
    markRequestsPopped(['req-1', 'req-2']);
    const popped = getPoppedRequestIds();
    expect(popped.has('req-1')).toBe(true);
    expect(popped.has('req-2')).toBe(true);
    expect(popped.has('req-3')).toBe(false);
  });

  it('accumulates ids across multiple calls instead of overwriting', () => {
    markRequestsPopped(['req-1']);
    markRequestsPopped(['req-2']);
    expect(getPoppedRequestIds()).toEqual(new Set(['req-1', 'req-2']));
  });

  it('is a no-op for an empty id list (no unnecessary mutation)', () => {
    markRequestsPopped(['req-1']);
    const before = getPoppedRequestIds();
    markRequestsPopped([]);
    expect(getPoppedRequestIds()).toEqual(before);
  });

  it('re-marking an already-popped id keeps the set stable (idempotent)', () => {
    markRequestsPopped(['req-1']);
    markRequestsPopped(['req-1']);
    expect(getPoppedRequestIds()).toEqual(new Set(['req-1']));
  });

  it('resetPoppedRequestIds() clears the watermark (once-per-sign-in cadence)', () => {
    markRequestsPopped(['req-1']);
    resetPoppedRequestIds();
    expect(getPoppedRequestIds()).toEqual(new Set());
  });
});
