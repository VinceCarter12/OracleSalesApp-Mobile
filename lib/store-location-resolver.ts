// Store Locations (C&D maps, 2026-08-17): decides WHICH coordinate a collection
// store / delivery PO is drawn at on the map. A store can relocate, and its
// admin-registered address is often stale or missing, so we resolve a display
// location by precedence rather than trusting any single source:
//
//   1. field_set  — the CURRENT client_locations pin the field officer set on
//                    the ground (most authoritative: someone physically there).
//   2. office_pin  — the client's registered office pin (clients.office_lat/lng).
//   3. visit_gps   — the GPS captured with THIS visit/PO's proof photo (only
//                    exists AFTER the stop was worked; a rough fallback).
//   4. null        — nothing known yet; the screen lists it as "location not set".
//
// Pure + input-only so it's unit-testable and reused by both the collection and
// delivery map builders. DB reads happen in the hook (use-store-locations.ts);
// this never touches SQLite.

export type StoreLocationOrigin = 'field_set' | 'office_pin' | 'visit_gps';

export interface ResolvedStoreLocation {
  lat: number;
  lng: number;
  origin: StoreLocationOrigin;
}

export interface Coordinate {
  lat?: number | null;
  lng?: number | null;
}

export interface StoreLocationInputs {
  /** The CURRENT numbered client_locations pin, if the store has one set. */
  currentLocation?: Coordinate | null;
  /** The client's registered office pin (clients.office_lat / office_lng). */
  officePin?: Coordinate | null;
  /** GPS captured with this visit's / PO's proof photo (present only post-visit). */
  visitGps?: Coordinate | null;
}

/** A finite lat AND lng — guards against nulls, NaN, and partially-filled pairs. */
function isUsable(coord: Coordinate | null | undefined): coord is { lat: number; lng: number } {
  return (
    !!coord &&
    typeof coord.lat === 'number' &&
    typeof coord.lng === 'number' &&
    Number.isFinite(coord.lat) &&
    Number.isFinite(coord.lng)
  );
}

/**
 * Resolves the coordinate a store should be plotted at, following the
 * precedence in the module header. Returns null when no source is usable so the
 * caller can bucket the store under "location not set" instead of dropping a
 * pin at (0, 0).
 */
export function resolveStoreLocation(inputs: StoreLocationInputs): ResolvedStoreLocation | null {
  if (isUsable(inputs.currentLocation)) {
    return { lat: inputs.currentLocation.lat, lng: inputs.currentLocation.lng, origin: 'field_set' };
  }
  if (isUsable(inputs.officePin)) {
    return { lat: inputs.officePin.lat, lng: inputs.officePin.lng, origin: 'office_pin' };
  }
  if (isUsable(inputs.visitGps)) {
    return { lat: inputs.visitGps.lat, lng: inputs.visitGps.lng, origin: 'visit_gps' };
  }
  return null;
}
