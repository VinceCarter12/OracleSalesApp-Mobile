import { describe, expect, it } from 'vitest';
import { classifyAccountStatus } from './account-status-classify';

describe('classifyAccountStatus', () => {
  it('returns active when is_active is true', () => {
    expect(classifyAccountStatus({ data: { is_active: true }, error: null })).toBe('active');
  });

  it('returns suspended ONLY when is_active is explicitly false on a successful response', () => {
    expect(classifyAccountStatus({ data: { is_active: false }, error: null })).toBe('suspended');
  });

  it('returns unverified (never suspended) on a query error', () => {
    expect(classifyAccountStatus({ data: null, error: { message: 'network error' } })).toBe('unverified');
  });

  it('returns unverified (never suspended) when there is no row and no error', () => {
    expect(classifyAccountStatus({ data: null, error: null })).toBe('unverified');
  });

  it('returns unverified even if an error is present alongside data (defensive — error always wins)', () => {
    expect(classifyAccountStatus({ data: { is_active: false }, error: { message: 'timeout' } })).toBe('unverified');
  });
});
