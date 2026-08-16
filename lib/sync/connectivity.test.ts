import { describe, expect, it } from 'vitest';
import { isOfflineState } from './connectivity-state';

describe('isOfflineState', () => {
  it('treats offline and no_internet as offline', () => {
    expect(isOfflineState('offline')).toBe(true);
    expect(isOfflineState('no_internet')).toBe(true);
  });

  it('does not treat a real server/auth failure as offline', () => {
    expect(isOfflineState('backend_unreachable')).toBe(false);
    expect(isOfflineState('auth_required')).toBe(false);
  });

  it('does not treat online as offline', () => {
    expect(isOfflineState('online')).toBe(false);
  });
});
