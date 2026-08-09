import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { withTimeout } from './with-timeout';
import { getStoredAvatarUri } from './profile-avatar';
import { BIZLINK_COLORS } from './theme';
import type { LeafletMapMarker } from '../components/maps/LeafletWebViewMap';

// 2026-08-08: "You here" marker for the agent map (app/(tabs)/more/maps.tsx).
// Shows the signed-in user's profile picture, or the first letter of their
// first name when there's no avatar, at their current GPS location.
//
// Resolution is deliberately lighter than lib/gps.ts::captureGps() (which is
// for meeting-evidence pins: High accuracy + a strict recent-fix fallback):
// a map "you here" pin is passive context, so we use Balanced accuracy, a
// shorter timeout, and accept any last-known fix rather than throwing away
// the pin entirely when degraded/missing.

// Mirrors PHOTO/avatar conventions: same 10s ceiling, Balanced accuracy.
const USER_MARKER_TIMEOUT_MS = 10000;

/** Round "you" chip accent — navy, distinct from the office green pin. */
const USER_MARKER_COLOR = BIZLINK_COLORS.navy;

/**
 * Resolves the current user's "you are here" marker. First letter of the
 * first name comes from the session full name; the optional profile picture
 * comes from the locally-stored avatar uri (ADR-029). No-op-safe: returns
 * null until a location + identity are both available, and never throws.
 */
export function useUserMapMarker(authUid: string | undefined, fullName: string | null): LeafletMapMarker | null {
  const [marker, setMarker] = useState<LeafletMapMarker | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function resolve(): Promise<void> {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (cancelled || status !== 'granted') return;

          let lat: number | null = null;
          let lng: number | null = null;
          try {
            const position = await withTimeout(
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              USER_MARKER_TIMEOUT_MS,
              'user map marker GPS fix'
            );
            lat = position.coords.latitude;
            lng = position.coords.longitude;
          } catch {
            const last = await Location.getLastKnownPositionAsync();
            if (last) {
              lat = last.coords.latitude;
              lng = last.coords.longitude;
            }
          }
          if (cancelled || lat === null || lng === null) return;

          const imageUrl = authUid ? await getStoredAvatarUri(authUid) : null;
          if (cancelled) return;

          const initial = (fullName ?? '').trim().charAt(0).toUpperCase() || '?';
          setMarker({
            id: 'user:me',
            lat,
            lng,
            colorHex: USER_MARKER_COLOR,
            radius: 10,
            label: fullName ?? 'You',
            icon: { kind: 'user', imageUrl, text: initial },
          });
        } catch {
          // Permission denied, location services off, or a race — never crash
          // the maps screen; just omit the "you" pin.
        }
      }

      resolve();
      return () => {
        cancelled = true;
      };
    }, [authUid, fullName])
  );

  return marker;
}