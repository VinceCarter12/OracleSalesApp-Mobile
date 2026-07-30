import * as SecureStore from 'expo-secure-store';

// Batch 1 (ADR-036/ADR-037): device-local kill switches for the new policy
// modules in ./policies/. All default to `false` — nothing here is enabled
// until a later batch flips it on deliberately. Excluded from the vitest
// scope (imports `expo-secure-store`, a native module).

export const FEATURE_FLAGS = [
  'stage_policy_enforcement',
  'session_status_tiers',
  'quota_policy_engine',
  'edit_approval_gates',
  'telemetry_capture',
  // Batch 5 Slice 0 (ADR-051): reserved for Slice 3's lock-screen UI. Not
  // consumed anywhere yet — suspension enforcement (Slice 2) ships
  // unflagged since a security feature defaulting off would fail open.
  'app_root_lock',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

const FLAG_KEY_PREFIX = 'oracle_flag_';

function flagKey(flag: FeatureFlag): string {
  return `${FLAG_KEY_PREFIX}${flag}`;
}

/** Fails closed: any read error or missing key returns false — a flag is only "on" if explicitly persisted as such. */
export async function isFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(flagKey(flag));
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setFeatureEnabled(flag: FeatureFlag, enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(flagKey(flag), enabled ? 'true' : 'false');
}
