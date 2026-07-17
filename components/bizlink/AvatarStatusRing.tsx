import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'tamagui';
import { BIZLINK_COLORS } from '../../lib/theme';
import { checkConnectivity, type ConnectivityState } from '../../lib/sync/connectivity';

interface AvatarStatusRingProps {
  children: React.ReactNode;
}

/**
 * T-014 Phase 3 (ADR-024): extracted from `app/(tabs)/index.tsx`'s Phase 2
 * wiring-only pass (2026-07-17) so the Manager Home avatar can reuse the same
 * live connectivity ring instead of duplicating the pattern. Mirrors
 * Wireframe-*-BizLink.html's `.avatar-ringwrap`/`.offline` + `updateAvatarStatus()`:
 * brand-green ring when online, red for any other `ConnectivityState`.
 * Checked on focus, same pattern as `SyncStatusChip`'s own on-focus fetch.
 */
export function AvatarStatusRing({ children }: AvatarStatusRingProps) {
  const [connectivity, setConnectivity] = useState<ConnectivityState>('online');

  useFocusEffect(
    useCallback(() => {
      checkConnectivity().then(setConnectivity).catch(() => {});
    }, [])
  );

  const ringColor = connectivity === 'online' ? BIZLINK_COLORS.brand : BIZLINK_COLORS.red;

  return (
    <View borderRadius={999} borderWidth={2.5} borderColor={ringColor} padding={3}>
      {children}
    </View>
  );
}
