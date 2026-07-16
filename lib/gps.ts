import * as Location from 'expo-location';
import { withTimeout } from './with-timeout';

const GPS_TIMEOUT_MS = 15000;

export interface GpsFix {
  lat: number;
  lng: number;
}

/**
 * GPS capture that actually works offline. `getCurrentPositionAsync` with
 * `Accuracy.High` can hang indefinitely with no network connection — Android
 * normally speeds up a fix with network-assisted positioning (A-GPS), and
 * without it a pure satellite fix can take a long time or never resolve
 * indoors. There was no timeout anywhere, so every meeting save silently
 * blocked forever offline (the save button just never re-enabled, no error
 * shown — `doSave()`/`startMeeting()` wait on `location`/`start` state that
 * never gets set).
 *
 * Fix: `Accuracy.Balanced` (works fine on GPS satellites alone, no network
 * dependency) with a hard timeout, falling back to the last cached fix
 * (`getLastKnownPositionAsync`, instant, fully offline) if a fresh one
 * doesn't arrive in time.
 */
export async function captureGps(): Promise<GpsFix> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required.');
  }
  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      GPS_TIMEOUT_MS,
      'GPS fix'
    );
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    const last = await Location.getLastKnownPositionAsync({});
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    throw new Error('Could not get GPS location. Move to an open area and try again.');
  }
}
