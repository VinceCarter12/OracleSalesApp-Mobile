import * as SecureStore from 'expo-secure-store';

/**
 * Batch 5 Slice 3 refinement (ADR-051 "SLICE 3 REFINEMENT", 2026-07-30):
 * the per-user/per-device app-root-lock opt-in toggle (`LockToggleRow`).
 * This is deliberately NOT the same thing as `'app_root_lock'` in
 * lib/feature-flags.ts — that flag is a rollout kill-switch (defaults off,
 * flipped on once when Vince is ready to ship the lock UI to everyone);
 * this preference is a per-device user choice ("I want fingerprint unlock
 * on this phone"). Both must be true for the lock to actually engage
 * (`lock-state.ts`'s `computeLockEnabled()`).
 */
const LOCK_PREFERENCE_KEY = 'oracle_app_lock_user_preference';

/** Fails closed: any read error or missing key returns false — matches lib/feature-flags.ts's convention. */
export async function getLockPreference(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(LOCK_PREFERENCE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setLockPreference(value: boolean): Promise<void> {
  await SecureStore.setItemAsync(LOCK_PREFERENCE_KEY, value ? 'true' : 'false');
}
