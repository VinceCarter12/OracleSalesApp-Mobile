import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getOutboxCounts, runSync, type OutboxCounts } from './sync-engine';
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

export function useSync(agentId: string | null): SyncStatus {
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
    setIsSyncing(true);
    try {
      const result = await runSync(agentId);
      if (result) {
        setConnectivity(result.connectivity);
        if (result.connectivity === 'online') setLastSyncedAt(new Date());
      }
    } catch {
      // Errors are per-row inside processOutbox; a thrown error here means
      // sync-down failed — next connectivity flip (or the 30s drain timer) retries.
    } finally {
      setIsSyncing(false);
      refreshPendingCount();
    }
  }, [agentId, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (!agentId) return;

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
