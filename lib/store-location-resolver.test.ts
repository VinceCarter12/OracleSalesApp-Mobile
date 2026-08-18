import { describe, expect, it } from 'vitest';
import { resolveStoreLocation } from './store-location-resolver';

describe('resolveStoreLocation', () => {
  const field = { lat: 14.1, lng: 120.1 };
  const office = { lat: 14.2, lng: 120.2 };
  const visit = { lat: 14.3, lng: 120.3 };

  it('prefers the current field-set location over everything else', () => {
    expect(resolveStoreLocation({ currentLocation: field, officePin: office, visitGps: visit })).toEqual({
      lat: 14.1,
      lng: 120.1,
      origin: 'field_set',
    });
  });

  it('falls back to the office pin when there is no field-set location', () => {
    expect(resolveStoreLocation({ currentLocation: null, officePin: office, visitGps: visit })).toEqual({
      lat: 14.2,
      lng: 120.2,
      origin: 'office_pin',
    });
  });

  it('falls back to the visit GPS when there is no field-set location or office pin', () => {
    expect(resolveStoreLocation({ officePin: null, visitGps: visit })).toEqual({
      lat: 14.3,
      lng: 120.3,
      origin: 'visit_gps',
    });
  });

  it('returns null when nothing is known (so the caller can show "location not set")', () => {
    expect(resolveStoreLocation({})).toBeNull();
    expect(resolveStoreLocation({ currentLocation: null, officePin: null, visitGps: null })).toBeNull();
  });

  it('skips a source whose coordinates are not a finite pair', () => {
    // A half-filled pair (lat but no lng) must NOT be used — fall through instead.
    expect(
      resolveStoreLocation({ currentLocation: { lat: 14.1, lng: null }, officePin: office })
    ).toEqual({ lat: 14.2, lng: 120.2, origin: 'office_pin' });

    // NaN / non-number coordinates are ignored the same way.
    expect(
      resolveStoreLocation({ currentLocation: { lat: Number.NaN, lng: Number.NaN }, visitGps: visit })
    ).toEqual({ lat: 14.3, lng: 120.3, origin: 'visit_gps' });
  });

  it('treats a valid 0,0 pair as finite (guards against truthiness bugs), but that is outside PH so callers still validate', () => {
    // Purely a finiteness check — resolver does not do geography; the PH guard
    // lives in the write path (store-location-service). 0,0 is finite, so it
    // resolves rather than being dropped as "unknown".
    expect(resolveStoreLocation({ currentLocation: { lat: 0, lng: 0 } })).toEqual({
      lat: 0,
      lng: 0,
      origin: 'field_set',
    });
  });
});
