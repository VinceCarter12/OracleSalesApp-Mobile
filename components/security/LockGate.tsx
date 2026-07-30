import type { ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { View } from 'tamagui';
import { useAppLock } from '../../lib/app-lock/lock-provider';
import { useSession } from '../../lib/session-store';
import { isExemptFromRootLock } from '../../lib/app-lock/lock-route-exemptions';
import { LockScreen } from './LockScreen';

/**
 * Batch 5 Slice 3 (ADR-051): single global lock overlay, mounted in
 * app/_layout.tsx wrapping `RootNavigator`. Renders `LockScreen` as an
 * OPAQUE OVERLAY on top of `children` — NOT a tree swap — so `useSync` and
 * any in-progress meeting recording keep running underneath while locked.
 * Replaces `GateProvider`/`useGate()` in the active tree (those files are
 * kept, not deleted, until Slice 4).
 *
 * Two reasons the overlay is suppressed even while `phase === 'locked'`:
 * 1. `suspended` (Slice 2) always wins — `RootNavigator` renders
 *    `AccountSuspendedScreen` in that case, and an opaque lock overlay on
 *    top of it would hide that stronger, more specific message.
 * 2. Manager reassignment carve-out (ADR-051, Vince's deliberate override):
 *    `app/(manager)/more/clients/**` must never show the lock overlay, even
 *    while every other route is locked — see lock-route-exemptions.ts.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { phase } = useAppLock();
  const { suspended } = useSession();
  const segments = useSegments();

  const showLockScreen = phase === 'locked' && !suspended && !isExemptFromRootLock(segments);

  return (
    <View flex={1}>
      {children}
      {showLockScreen ? (
        <View position="absolute" top={0} left={0} right={0} bottom={0}>
          <LockScreen />
        </View>
      ) : null}
    </View>
  );
}
