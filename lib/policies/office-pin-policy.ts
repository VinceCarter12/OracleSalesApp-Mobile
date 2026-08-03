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

export type OfficePinSourceValue = 'manual' | 'client_office_meeting' | null | undefined;

/**
 * Batch 8 (2026-08-02): Wireframe `a-maps`/`aRenderOfficeMaps()`
 * (Wireframe-Sales-BizLink.html ~line 1377) splits pins into
 * verified/unverified. The auto-capture path
 * (`createMeeting()` → `writeOfficePinLocal()` with
 * `source: 'client_office_meeting'`, see lib/office-pin-service.ts) is the
 * ONLY source that counts as verified — it is a GPS fix taken at the moment
 * of an actual Client Office visit. The manual Set/Update Office Location
 * flow (`app/(tabs)/clients/office-location.tsx`) always writes
 * `source: 'manual'`, even though it also captures live GPS, because the
 * agent could be capturing it from anywhere, not necessarily standing at the
 * client's office — so it stays unverified until a real Client Office visit
 * happens.
 */
export function isOfficePinVerified(source: OfficePinSourceValue): boolean {
  return source === 'client_office_meeting';
}
