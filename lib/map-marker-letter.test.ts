import { describe, expect, it } from 'vitest';
import { firstMarkerLetter } from './map-marker-letter';

describe('firstMarkerLetter', () => {
  it('returns the uppercased first letter of a normal label', () => {
    expect(firstMarkerLetter('RMC Fuels')).toBe('R');
  });

  it('trims leading whitespace before taking the first letter', () => {
    expect(firstMarkerLetter('  starbucks alabang')).toBe('S');
  });

  it('falls back to "?" for an empty or whitespace-only label', () => {
    expect(firstMarkerLetter('')).toBe('?');
    expect(firstMarkerLetter('   ')).toBe('?');
  });
});
