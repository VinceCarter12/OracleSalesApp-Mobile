import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Batch 5 Slice 0 (ADR-051): thin wrapper around expo-local-authentication.
 * Pure logic only — no UI. `LockScreen.tsx`/`AppLockProvider` (Slice 3) are
 * the consumers of this module; this slice only installs the native
 * dependency and exposes the capability/unlock primitives it needs.
 */

export type UnlockCapability = 'biometric' | 'device_credential' | 'none';

/**
 * Classifies what the device can currently offer for unlock. Must be
 * freshly probed on every call — never cache the result at module load —
 * because biometric enrollment (e.g. a user adding/removing a fingerprint,
 * or setting up a PIN) can change while the app is backgrounded, and a
 * stale cached value would misreport the device's real capability.
 */
export async function getUnlockCapability(): Promise<UnlockCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return 'none';

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) return 'none';

  const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
  if (
    enrolledLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG ||
    enrolledLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK
  ) {
    return 'biometric';
  }
  if (enrolledLevel === LocalAuthentication.SecurityLevel.SECRET) return 'device_credential';
  return 'none';
}

/**
 * Prompts the OS unlock UI. `disableDeviceFallback: false` is required —
 * it is what lets the OS itself offer PIN/pattern/password when biometric
 * fails or is not enrolled (ADR-051's mandated Android device-credential
 * fallback). Returns whether the authentication attempt succeeded.
 */
export async function requestDeviceUnlock(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  return result.success;
}
