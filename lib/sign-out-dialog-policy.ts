import type { OutboxCounts } from './sync-engine';
import { describeUnsyncedWork, getUnsyncedWorkCount } from './sign-out-sync-status';

/**
 * Which of the sign-out dialog's variants is showing, plus the copy each one
 * needs. Mirrors the branches the old `Alert.alert`-based
 * `requestSignOutWithSyncWarning` used to hardcode (lib/sign-out-with-sync-warning.ts,
 * removed) — same titles/wording, now driven by state instead of imperative calls.
 *
 * Kept in its own file (no runtime import of `./sync-engine`, only the
 * `OutboxCounts` type) so it stays testable under this repo's Vitest, which
 * cannot parse the `react-native`/`expo-router` chain pulled in by
 * `sync-engine.ts`'s runtime exports (`getOutboxCounts`, `runSync`).
 */
export type SignOutDialogVariant =
  | { kind: 'check-failed' }
  | { kind: 'confirm' }
  | { kind: 'unsynced'; description: string }
  | { kind: 'sync-unavailable' }
  | { kind: 'sync-complete' }
  | { kind: 'sync-incomplete'; description: string }
  | { kind: 'sign-out-failed'; message: string };

/** Which dialog to show once the outbox has been checked. */
export function resolveInitialDialog(counts: OutboxCounts): SignOutDialogVariant {
  if (getUnsyncedWorkCount(counts) === 0) {
    return { kind: 'confirm' };
  }
  return { kind: 'unsynced', description: describeUnsyncedWork(counts) };
}

/** Which dialog to show once a "Sync now" run has finished. */
export function resolveSyncResultDialog(counts: OutboxCounts): SignOutDialogVariant {
  if (getUnsyncedWorkCount(counts) === 0) {
    return { kind: 'sync-complete' };
  }
  return { kind: 'sync-incomplete', description: describeUnsyncedWork(counts) };
}
