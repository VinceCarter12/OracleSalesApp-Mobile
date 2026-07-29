// Batch 4 (2026-07-29): pure, zero-import gating helper for the permanent
// client office pin — split out from lib/office-pin-service.ts so it (and
// its test) never pull in that file's expo-sqlite/react-native-transitive
// imports, matching this app's other lib/policies/*.ts pure-module
// convention (e.g. lib/local-day.ts, lib/policies/stage-policy.ts).

/**
 * A client's office pin is only "set" once BOTH lat and lng are non-null.
 * `!= null` (not truthiness) matters here: `0, 0` is a real (if unlikely)
 * coordinate pair, not an absent pin. Shared by Client Detail's button
 * label (app/(tabs)/clients/[id].tsx) and the office-location screen itself
 * (app/(tabs)/clients/office-location.tsx).
 */
export function hasOfficePin(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return lat != null && lng != null;
}
