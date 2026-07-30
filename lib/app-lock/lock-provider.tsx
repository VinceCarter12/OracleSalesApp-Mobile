import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSession, type SessionStatus } from '../session-store';
import { isFeatureEnabled } from '../feature-flags';
import { getUnlockCapability, requestDeviceUnlock } from '../device-unlock';
import { getLockPreference } from './lock-preference';
import { computeLockEnabled, shouldRelock, type LockPhase, type UnlockCapability } from './lock-state';

// Vince's final decision (ADR-051) — not the architecture-reviewer's 10-30s
// suggestion, not the wireframes' "relock on every backgrounding".
const RELOCK_WINDOW_MS = 60 * 60 * 1000;
const UNLOCK_PROMPT_MESSAGE = 'Unlock BizLink to continue';

interface AppLockStore {
  /** Drives `LockGate` — 'locked' renders the opaque `LockScreen` overlay. */
  phase: LockPhase;
  /** Whether flag + user preference + device capability all agree the lock should engage (lock-state.ts). */
  lockEnabled: boolean;
  capability: UnlockCapability;
  /** Prompts the native device-credential UI; only flips phase to 'unlocked' on success. */
  unlock: () => Promise<boolean>;
  /** Re-reads flag/preference/capability — call after `LockToggleRow` changes the stored preference. */
  refreshLockConfig: () => Promise<void>;
}

const AppLockContext = createContext<AppLockStore | null>(null);

/** Holds lockEnabled/capability state and the loader that (re)computes them from the flag, the per-user preference, and a fresh device-capability probe. */
function useLockConfigState() {
  const [lockEnabled, setLockEnabled] = useState(false);
  const [capability, setCapability] = useState<UnlockCapability>('none');

  const load = useCallback(async (): Promise<boolean> => {
    const [flagEnabled, userPreferenceEnabled, cap] = await Promise.all([
      isFeatureEnabled('app_root_lock'),
      getLockPreference(),
      getUnlockCapability(),
    ]);
    setCapability(cap);
    const enabled = computeLockEnabled({ flagEnabled, userPreferenceEnabled, capability: cap });
    setLockEnabled(enabled);
    return enabled;
  }, []);

  return { lockEnabled, capability, load };
}

/**
 * Reuses `use-suspension-watch.ts`'s AppState pattern (background/active
 * only, `inactive` is transient OS-dialog noise). Records the backgrounded
 * timestamp in memory only (never persisted) — a fresh cold start already
 * goes through its own lock check via `AppLockProvider`'s session-status
 * effect below.
 */
function useForegroundRelock(active: boolean, onRelockDue: () => void): MutableRefObject<number | null> {
  const lastBackgroundedAtRef = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (previousState === 'active' && nextState === 'background') {
        lastBackgroundedAtRef.current = Date.now();
        return;
      }
      if (previousState === 'background' && nextState === 'active' && active) {
        if (shouldRelock(lastBackgroundedAtRef.current, Date.now(), RELOCK_WINDOW_MS)) {
          onRelockDue();
        }
      }
    });
    return () => subscription.remove();
  }, [active, onRelockDue]);

  return lastBackgroundedAtRef;
}

/**
 * Resolves `phase` from session status — 'bootstrapping'/'signed_out' map
 * directly, 'signed_in' triggers `load()` (flag + preference + capability)
 * and resolves to 'locked'/'unlocked'. Extracted out of `AppLockProvider`
 * to keep that function under this repo's 40-line limit, same extraction
 * pattern as `useLockConfigState`/`useForegroundRelock` above.
 */
function usePhaseResolution(
  status: SessionStatus,
  load: () => Promise<boolean>,
  lastBackgroundedAtRef: MutableRefObject<number | null>,
  setPhase: (phase: LockPhase) => void
): void {
  useEffect(() => {
    if (status === 'bootstrapping') {
      setPhase('bootstrapping');
      return;
    }
    if (status === 'signed_out') {
      setPhase('signed_out');
      lastBackgroundedAtRef.current = null;
      return;
    }
    let cancelled = false;
    void load().then((enabled) => {
      if (!cancelled) setPhase(enabled ? 'locked' : 'unlocked');
    });
    return () => {
      cancelled = true;
    };
  }, [status, load, lastBackgroundedAtRef, setPhase]);
}

/**
 * Batch 5 Slice 3 (ADR-051): single owner of app-root lock UI state,
 * distinct from `useSession()` (kept as-is, no renaming/collision — ADR-051
 * explicitly rejected folding this into a unified session module). Works
 * alongside `useSession()`'s existing `suspended` flag (Slice 2) rather than
 * duplicating it — `LockGate` checks both.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [phase, setPhase] = useState<LockPhase>('bootstrapping');
  const { lockEnabled, capability, load } = useLockConfigState();
  const onRelockDue = useCallback(() => setPhase('locked'), []);
  const lastBackgroundedAtRef = useForegroundRelock(status === 'signed_in' && lockEnabled, onRelockDue);

  usePhaseResolution(status, load, lastBackgroundedAtRef, setPhase);

  const unlock = useCallback(async (): Promise<boolean> => {
    const success = await requestDeviceUnlock(UNLOCK_PROMPT_MESSAGE);
    if (success) {
      setPhase('unlocked');
      lastBackgroundedAtRef.current = null;
    }
    return success;
  }, [lastBackgroundedAtRef]);

  const refreshLockConfig = useCallback(async (): Promise<void> => {
    await load();
  }, [load]);

  const value = useMemo(
    () => ({ phase, lockEnabled, capability, unlock, refreshLockConfig }),
    [phase, lockEnabled, capability, unlock, refreshLockConfig]
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockStore {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within an AppLockProvider');
  return ctx;
}
