import * as Location from 'expo-location';
import { withTimeout } from './with-timeout';

// A precise, at-the-moment fix matters for a collection/delivery pin (it's the
// evidence of WHERE a stop was worked), so we ask for a real high-accuracy read
// and give it room to resolve — but never hang: a hard timeout always fires.
const GPS_TIMEOUT_MS = 20000;
// A last-known fix is only trustworthy if it's RECENT. A cached position from an
// hour (or a town) ago is exactly "not where I am now", which is worse than no
// pin at all — so the offline fallback rejects anything older than this.
const STALE_FIX_MAX_AGE_MS = 30000;

export interface GpsFix {
  lat: number;
  lng: number;
}

/**
 * Captures the device's current location for a meeting / collection / delivery
 * pin. Uses `Accuracy.High` for a genuine ~10m fix (the earlier `Balanced` read
 * was city-block coarse and could report the wrong spot). `getCurrentPositionAsync`
 * can hang with no A-GPS/network assist, so it's raced against a hard timeout.
 *
 * On timeout it falls back to `getLastKnownPositionAsync` — but ONLY a fix
 * captured within `STALE_FIX_MAX_AGE_MS`, so a stale cached position from a
 * different location never masquerades as the current one. If no fresh fix is
 * available at all it throws, and the caller records "no pin" rather than a
 * misleading one.
 */
export async function captureGps(): Promise<GpsFix> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required.');
  }
  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      GPS_TIMEOUT_MS,
      'GPS fix'
    );
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    const last = await Location.getLastKnownPositionAsync({ maxAge: STALE_FIX_MAX_AGE_MS });
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    throw new Error('Could not get GPS location. Move to an open area and try again.');
  }
}
