import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getOutboxCounts, runSync, type OutboxCounts } from './sync-engine';
import { createAdaptiveForegroundScheduler } from './sync/adaptive-foreground-scheduler';
import type { ConnectivityState } from './sync/connectivity';
import type { AppStateStatus } from 'react-native';
import type { UserRole } from '../types';

// T-002/T-005/T-014, Phase 1 adaptive scheduling (2026-08-04, Vince direction
// — see projects/OracleSalesApp-Mobile/Sync-Scale-and-Realtime-Options-2026-08-04.md):
// fires an immediate sync on login/foreground/reconnect, plus an adaptive
// ~30-60s(+backoff) foreground-only idle timer for anything those triggers
// missed (lib/sync/adaptive-foreground-scheduler.ts). Replaces the old fixed
// 10s `setInterval` drain timer, which ran a full push+pull pass every 10s
// per active device regardless of whether anything had changed. Manual Sync
// (SyncCenterSheet) and every write-service's post-write sync still call
// `runSync()` directly — safe now against overlap via sync-engine.ts's own
// coalescing coordinator, not just this hook's scheduler. Exposes status for
// the Sync Center UI. Mount once near the root (see app/_layout.tsx), guarded
// by `agentId` so it never runs before a session exists.

const EMPTY_OUTBOX_COUNTS: OutboxCounts = { pending: 0, syncing: 0, conflict: 0, failed: 0, synced: 0 };

export interface SyncStatus {
  isSyncing: boolean;
  // Kept for existing consumers — pending-only, same as before T-005.
  pendingCount: number;
  outboxCounts: OutboxCounts;
  lastSyncedAt: Date | null;
  connectivity: ConnectivityState | null;
}

export function useSync(agentId: string | null, teamId?: string | null, role?: UserRole | null): SyncStatus {
  const [isSyncing, setIsSyncing] = useState(false);
  const [outboxCounts, setOutboxCounts] = useState<OutboxCounts>(EMPTY_OUTBOX_COUNTS);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityState | null>(null);

  const refreshPendingCount = useCallback(() => {
    getOutboxCounts()
      .then(setOutboxCounts)
      .catch(() => {});
  }, []);

  // Returns `{ changed }` so the adaptive scheduler can back off on repeated
  // zero-change idle ticks and reset the moment something actually moved —
  // see lib/sync/adaptive-sync-interval.ts's doc comment for the Phase 1
  // limitation this implies (local outbox push activity only; a purely
  // remote-only change can't be detected as "changed" without Phase 2's
  // per-entity cursors).
  const sync = useCallback(async (): Promise<{ changed: boolean }> => {
    if (!agentId) return { changed: false };
    setIsSyncing(true);
    try {
      const result = await runSync(agentId, teamId, role);
      if (result) {
        setConnectivity(result.connectivity);
        if (result.connectivity === 'online') {
          setLastSyncedAt(new Date());
          // Local data (clients/meetings/etc.) may have just changed — tell
          // already-mounted screens to re-read SQLite. `runSync()` only
          // reaches `syncDown()` (and thus actually changes local data) on
          // the 'online' path, so this can't fire on a no-op offline attempt.
        }
        return { changed: result.synced > 0 || result.failed > 0 };
      }
      return { changed: false };
    } catch (err) {
      // Errors are per-row inside processOutbox; a thrown error here means
      // sync-down failed — the next trigger (or the adaptive idle timer) retries.
      console.error('[use-sync] sync failed:', err instanceof Error ? err.message : String(err));
      return { changed: false };
    } finally {
      setIsSyncing(false);
      refreshPendingCount();
    }
  }, [agentId, teamId, role, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useAdaptiveSyncScheduler(agentId, sync);

  return { isSyncing, pendingCount: outboxCounts.pending, outboxCounts, lastSyncedAt, connectivity };
}

/**
 * Wires the pure `AdaptiveForegroundScheduler` (lib/sync/adaptive-foreground-
 * scheduler.ts) to AppState (foreground/background) and NetInfo (reconnect).
 * All the actual interval/backoff/jitter/coalescing logic lives in that pure
 * module — this is just the React/native-module glue, deliberately thin so
 * the scheduling behavior itself stays unit-testable without RN mocks.
 *
 * Subsumes the old dedicated "new session — immediate sync" effect (B-071):
 * the scheduler's own mount-time `triggerImmediate()` below fires
 * immediately whenever `agentId` changes (fresh login or account switch)
 * while the app is active, which is the same guarantee — deterministic,
 * doesn't depend on NetInfo's listener firing an immediate callback on
 * subscribe (timing/version-dependent on some devices).
 */
function useAdaptiveSyncScheduler(agentId: string | null, sync: () => Promise<{ changed: boolean }>): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const wasOffline = useRef(true);

  useEffect(() => {
    if (!agentId) return;

    const scheduler = createAdaptiveForegroundScheduler({ runPass: sync });

    // Reset on every new session (fresh login / account switch), not just
    // app cold start. `wasOffline` is a ref that outlives sign-out/sign-in —
    // once it flips to `false` for one account, it stays `false` across a
    // later account switch even if the device never actually went offline,
    // silently skipping the "just came online" sync that normally pulls the
    // new account's data into (empty, per-agent-scoped) SQLite right after
    // login.
    wasOffline.current = true;

    if (appState.current === 'active') {
      void scheduler.triggerImmediate();
      scheduler.start();
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void scheduler.triggerImmediate();
        scheduler.start();
      } else {
        // No background timer runs at all — not even one that early-returns
        // — since even a no-op interval costs OS background-execution
        // budget; the timer is torn down (not just skipped) whenever the
        // app isn't active, and re-armed on foreground return.
        scheduler.stop();
      }
      appState.current = nextState;
    });

    // NetInfo.addEventListener returns the unsubscribe function directly
    // (not a subscription object with `.remove()`, unlike AppState above).
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (isOnline && wasOffline.current) {
        void scheduler.triggerImmediate();
      }
      wasOffline.current = !isOnline;
    });

    return () => {
      scheduler.stop();
      appStateSubscription.remove();
      unsubscribeNetInfo();
    };
  }, [agentId, sync]);
}
