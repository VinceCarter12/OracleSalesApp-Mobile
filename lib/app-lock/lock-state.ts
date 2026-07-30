// Batch 5 Slice 3 (ADR-051 + "SLICE 3 REFINEMENT" addendum): pure lock-state
// logic, split out of lock-provider.tsx so it can be unit-tested directly
// (vitest's node environment cannot import lock-provider.tsx itself — it
// transitively pulls in react-native via lib/session-store.tsx and
// lib/device-unlock.ts; same reason bootstrap-decision.ts and
// account-status-classify.ts were split out in Slices 1/2).

export type LockPhase = 'bootstrapping' | 'signed_out' | 'locked' | 'unlocked';

/**
 * Mirrors `lib/device-unlock.ts`'s `UnlockCapability` — duplicated as a
 * local literal union (not imported) so this file stays free of any
 * transitive react-native/expo-local-authentication dependency, matching
 * `session-snapshot.ts`'s `SNAPSHOT_ROLE_VALUES` precedent for trust/test
 * boundary isolation.
 */
export type UnlockCapability = 'biometric' | 'device_credential' | 'none';

export interface LockConfigInput {
  /** The 'app_root_lock' rollout kill-switch (lib/feature-flags.ts). */
  flagEnabled: boolean;
  /** The per-user/per-device opt-in (lib/app-lock/lock-preference.ts). */
  userPreferenceEnabled: boolean;
  capability: UnlockCapability;
}

/**
 * Both the rollout flag AND the user's own opt-in must be true, AND the
 * device must actually have a credential enrolled — matches ADR-051 point 6
 * ("no device lock → auto-unlock + advisory") and the Slice 3 refinement's
 * disabled-toggle rule, now unified: flag-off, preference-off, and
 * no-device-credential all resolve to the same "no lock" behavior.
 */
export function computeLockEnabled(config: LockConfigInput): boolean {
  return config.flagEnabled && config.userPreferenceEnabled && config.capability !== 'none';
}

/**
 * Relocks only after the app has been backgrounded for at least the 1-hour
 * relock window (Vince's final decision, ADR-051 — not the
 * architecture-reviewer's 10-30s suggestion, not "every backgrounding" as
 * the wireframes show). `lastBackgroundedAt === null` means the app has
 * never been backgrounded since it last unlocked, so it never relocks on
 * that basis alone.
 */
export function shouldRelock(lastBackgroundedAt: number | null, now: number, relockWindowMs: number): boolean {
  if (lastBackgroundedAt === null) return false;
  return now - lastBackgroundedAt >= relockWindowMs;
}
