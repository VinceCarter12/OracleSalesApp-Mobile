import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getOutboxCounts, runSync, type OutboxCounts } from './sync-engine';
import { notifySyncComplete } from './sync/sync-events';
import type { ConnectivityState } from './sync/connectivity';
import type { AppStateStatus } from 'react-native';

// T-002/T-005/T-014: fires a sync whenever connectivity flips online, plus a
// 30s foreground-only drain timer (ADR-022 #10) for anything a reconnect
// event missed. Exposes status for a future UI indicator (Phase B — see
// Migration-014-Report.md / Migration-015-Report.md). Mount once near the
// root (see app/_layout.tsx), guarded by `agentId` so it never runs before a
// session exists.

const EMPTY_OUTBOX_COUNTS: OutboxCounts = { pending: 0, syncing: 0, conflict: 0, failed: 0, synced: 0 };
const FOREGROUND_DRAIN_INTERVAL_MS = 30000;

export interface SyncStatus {
  isSyncing: boolean;
  // Kept for existing consumers — pending-only, same as before T-005.
  pendingCount: number;
  outboxCounts: OutboxCounts;
  lastSyncedAt: Date | null;
  connectivity: ConnectivityState | null;
}

export function useSync(agentId: string | null, teamId?: string | null): SyncStatus {
  const [isSyncing, setIsSyncing] = useState(false);
  const [outboxCounts, setOutboxCounts] = useState<OutboxCounts>(EMPTY_OUTBOX_COUNTS);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityState | null>(null);
  const wasOffline = useRef(true);

  const refreshPendingCount = useCallback(() => {
    getOutboxCounts()
      .then(setOutboxCounts)
      .catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    if (!agentId) return;
    // B-071 diagnostic trace (temporary, `console.warn` not `.log` per
    // coding standards) — confirms via `adb logcat | grep use-sync` whether
    // this fix is actually the code running on-device, and if so, exactly
    // where a sync attempt is stalling (connectivity vs. never firing at all).
    console.warn('[use-sync] sync() starting', { agentId, teamId });
    setIsSyncing(true);
    try {
      const result = await runSync(agentId, teamId);
      console.warn('[use-sync] runSync result', result);
      if (result) {
        setConnectivity(result.connectivity);
        if (result.connectivity === 'online') {
          setLastSyncedAt(new Date());
          // Local data (clients/meetings/etc.) may have just changed — tell
          // already-mounted screens to re-read SQLite. `runSync()` only
          // reaches `syncDown()` (and thus actually changes local data) on
          // the 'online' path, so this can't fire on a no-op offline attempt.
          notifySyncComplete();
        }
      }
    } catch (err) {
      // Errors are per-row inside processOutbox; a thrown error here means
      // sync-down failed — next connectivity flip (or the 30s drain timer) retries.
      console.warn('[use-sync] sync() threw', err instanceof Error ? err.message : String(err));
    } finally {
      setIsSyncing(false);
      refreshPendingCount();
    }
  }, [agentId, teamId, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Deterministic post-login sync — does not rely on NetInfo's listener
  // firing an immediate callback on subscribe (timing/version-dependent,
  // and was the cause of B-071 even after the `wasOffline` reset below: the
  // very first callback after a fresh subscribe can report
  // `isInternetReachable`/`isConnected` as not-yet-determined on some
  // devices, silently skipping the sync it was supposed to trigger). Fires
  // once per new session so a fresh login (or account switch) always
  // attempts a full push+pull immediately, regardless of listener timing.
  // `runSync()`'s own `checkConnectivity()` (a direct `NetInfo.fetch()`
  // call, not a listener) is the real online/offline source of truth here —
  // if genuinely offline this just no-ops safely, same as any other
  // best-effort sync attempt.
  useEffect(() => {
    if (agentId) {
      console.warn('[use-sync] new session — triggering immediate sync', agentId);
      sync();
    }
  }, [agentId, sync]);

  useEffect(() => {
    if (!agentId) return;

    // Reset on every new session (fresh login / account switch), not just
    // app cold start. `wasOffline` is a ref that outlives sign-out/sign-in —
    // once it flips to `false` for one account, it stays `false` across a
    // later account switch even if the device never actually went offline,
    // silently skipping the "just came online" sync that normally pulls the
    // new account's data into (empty, per-agent-scoped) SQLite right after
    // login. Without this reset, the new account shows zero records on every
    // screen until some other event happens to enqueue an outbox row (e.g.
    // creating a client), whose drain-timer/post-write sync then pulls
    // everything in at once.
    wasOffline.current = true;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (isOnline && wasOffline.current) {
        sync();
      }
      wasOffline.current = !isOnline;
    });

    return unsubscribe;
  }, [agentId, sync]);

  useForegroundDrainTimer(agentId, sync);

  return { isSyncing, pendingCount: outboxCounts.pending, outboxCounts, lastSyncedAt, connectivity };
}

/**
 * Foreground-only 30s drain timer (ADR-022 #10): catches outbox rows a
 * missed reconnect event left behind, or whose scheduled `next_attempt_at`
 * has since elapsed. No background timer runs at all — not even one that
 * early-returns — since even a no-op interval costs OS background-execution
 * budget; the interval is torn down (not just skipped) whenever the app
 * isn't active, and re-armed on foreground return.
 */
function useForegroundDrainTimer(agentId: string | null, sync: () => Promise<void>): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!agentId) return;

    const drainIfPending = () => {
      getOutboxCounts()
        .then((counts) => {
          if (counts.pending > 0) sync();
        })
        .catch(() => {});
    };

    const startTimer = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(drainIfPending, FOREGROUND_DRAIN_INTERVAL_MS);
    };
    const stopTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (appState.current === 'active') startTimer();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') startTimer();
      else stopTimer();
      appState.current = nextState;
    });

    return () => {
      stopTimer();
      subscription.remove();
    };
  }, [agentId, sync]);
}
