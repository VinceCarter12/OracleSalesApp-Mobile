import { describe, expect, it } from 'vitest';
import { hasOfficePin } from './office-pin-policy';

describe('hasOfficePin', () => {
  it('returns true once both lat and lng are set', () => {
    expect(hasOfficePin(14.5547, 121.0244)).toBe(true);
  });

  it('returns false when either coordinate is null', () => {
    expect(hasOfficePin(null, 121.0244)).toBe(false);
    expect(hasOfficePin(14.5547, null)).toBe(false);
    expect(hasOfficePin(null, null)).toBe(false);
  });

  it('returns false when either coordinate is undefined', () => {
    expect(hasOfficePin(undefined, undefined)).toBe(false);
  });

  it('treats a literal 0,0 coordinate pair as a real captured pin, not "unset"', () => {
    expect(hasOfficePin(0, 0)).toBe(true);
  });
});
