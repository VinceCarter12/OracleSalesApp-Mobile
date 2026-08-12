import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useAppLock } from '../../lib/app-lock/lock-provider';
import { useSession } from '../../lib/session-store';
import { isExemptFromRootLock } from '../../lib/app-lock/lock-route-exemptions';

/**
 * Keeps Android's physical/system back button aligned with the app's shared
 * BizTopBar behavior. Native stack history remains authoritative; this only
 * handles the event explicitly so direct-entry Manager/Sales routes behave the
 * same as tapping the in-app back arrow.
 */
export function AndroidBackHandler() {
  const { status, suspended } = useSession();
  const { phase } = useAppLock();
  const segments = useSegments();
  const navigationLocked = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || status !== 'signed_in' || suspended) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // LockGate is an opaque overlay. Prevent the underlying route from
      // changing while locked, except on its deliberate Manager carve-out.
      if (phase === 'locked' && !isExemptFromRootLock(segments)) return true;
      if (navigationLocked.current) return true;
      if (!router.canGoBack()) return false;

      navigationLocked.current = true;
      router.back();
      setTimeout(() => {
        navigationLocked.current = false;
      }, 450);
      return true;
    });

    return () => subscription.remove();
  }, [phase, segments, status, suspended]);

  return null;
}
