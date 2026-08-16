import { describe, expect, it } from 'vitest';
import { normalizeCompanyName } from './company-name';

describe('normalizeCompanyName', () => {
  it.each([
    ['Test 1', 'test1'],
    ['test1', 'test1'],
    ['TEST-1', 'test1'],
    ['  Test. 1  ', 'test1'],
  ])('treats %s as %s', (input, expected) => {
    expect(normalizeCompanyName(input)).toBe(expected);
  });

  it('keeps a genuinely different name distinct', () => {
    expect(normalizeCompanyName('Test 12')).not.toBe(normalizeCompanyName('Test 1'));
  });
});
