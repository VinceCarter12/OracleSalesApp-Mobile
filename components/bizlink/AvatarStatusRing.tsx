import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { View } from 'tamagui';
import { useBizlinkColors } from '../../lib/theme';
import { checkConnectivity, type ConnectivityState } from '../../lib/sync/connectivity';
import { showToast } from '../../lib/toast';

interface AvatarStatusRingProps {
  children: React.ReactNode;
}

/**
 * T-014 Phase 3 (ADR-024): extracted from `app/(tabs)/index.tsx`'s Phase 2
 * wiring-only pass (2026-07-17) so the Manager Home avatar can reuse the same
 * live connectivity ring instead of duplicating the pattern. Mirrors
 * Wireframe-*-BizLink.html's `.avatar-ringwrap`/`.offline` + `updateAvatarStatus()`:
 * brand-green ring when online, red for any other `ConnectivityState`.
 *
 * B-022: was only checked on screen focus, so the ring didn't react while a
 * screen stayed open across an actual connectivity change (device going
 * offline mid-session never flipped the ring until the next focus). Now
 * also subscribes to `NetInfo.addEventListener` — same live-reconnect signal
 * `lib/use-sync.ts` already uses to trigger syncs — so a real transition
 * updates the ring immediately, not just on navigation. Also fires a toast
 * on an online→offline transition (never on mount, so it doesn't nag if the
 * agent opens the app already offline).
 */
export function AvatarStatusRing({ children }: AvatarStatusRingProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [connectivity, setConnectivity] = useState<ConnectivityState>('online');
  const hasCheckedOnce = useRef(false);

  const refresh = useCallback(() => {
    checkConnectivity()
      .then((next) => {
        setConnectivity((prev) => {
          if (hasCheckedOnce.current && prev === 'online' && next !== 'online') {
            showToast('Wala kang internet — offline mode, mase-save pa rin lahat locally.');
          }
          hasCheckedOnce.current = true;
          return next;
        });
      })
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(() => refresh());
    return unsubscribe;
  }, [refresh]);

  const ringColor = connectivity === 'online' ? BIZLINK_COLORS.brand : BIZLINK_COLORS.red;

  return (
    <View borderRadius={999} borderWidth={2.5} borderColor={ringColor} padding={3}>
      {children}
    </View>
  );
}
