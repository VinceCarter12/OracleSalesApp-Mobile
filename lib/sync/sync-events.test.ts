import { describe, expect, it, vi } from 'vitest';
import { notifySyncComplete, subscribeSyncComplete } from './sync-events';

// No renderHook coverage of `use-manager-request-feed.ts` itself: this repo's
// Vitest setup is Node-only (see vitest.config.ts) and both `expo-router`
// and `react-native` fail to parse under it (RolldownError: "Flow is not
// supported" — confirmed while writing this task's other tests), so a real
// hook can't be mounted here. This instead pins down the exact contract that
// hook (and every other subscriber — `useMeetings.ts`,
// `use-manager-attendance-history.ts`) relies on: one `notifySyncComplete()`
// call fires each active subscriber exactly once, and `unsubscribe()`
// silences that subscriber immediately, which together are what make "sync
// complete triggers exactly one reload, no double-fire" true for
// `useManagerRequestFeed`'s `useEffect(() => subscribeSyncComplete(load),
// [load])`.
describe('sync-events pub/sub contract', () => {
  it('calls a subscribed listener exactly once per notifySyncComplete()', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSyncComplete(listener);
    notifySyncComplete();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not double-fire a listener subscribed only once, even with other subscribers present', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const unsubA = subscribeSyncComplete(listenerA);
    const unsubB = subscribeSyncComplete(listenerB);
    notifySyncComplete();
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    unsubA();
    unsubB();
  });

  it('stops calling a listener once unsubscribed (no stale reload after unmount)', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSyncComplete(listener);
    unsubscribe();
    notifySyncComplete();
    expect(listener).not.toHaveBeenCalled();
  });

  it('re-subscribing the same callback instance twice only registers it once (Set semantics)', () => {
    const listener = vi.fn();
    const unsubscribe1 = subscribeSyncComplete(listener);
    const unsubscribe2 = subscribeSyncComplete(listener);
    notifySyncComplete();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe1();
    unsubscribe2();
  });
});
