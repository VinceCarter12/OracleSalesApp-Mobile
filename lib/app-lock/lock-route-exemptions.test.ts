import { describe, expect, it } from 'vitest';
import { isExemptFromRootLock } from './lock-route-exemptions';

describe('isExemptFromRootLock', () => {
  it('exempts the manager reassignment list screen', () => {
    expect(isExemptFromRootLock(['(manager)', 'more', 'clients', 'index'])).toBe(true);
  });

  it('exempts the manager reassignment detail screen', () => {
    expect(isExemptFromRootLock(['(manager)', 'more', 'clients', '[id]'])).toBe(true);
  });

  it('exempts nested screens under the carve-out, e.g. the reassign sub-flow', () => {
    expect(isExemptFromRootLock(['(manager)', 'more', 'clients', 'reassign'])).toBe(true);
  });

  it('does not exempt other manager screens', () => {
    expect(isExemptFromRootLock(['(manager)', 'more', 'meetings'])).toBe(false);
    expect(isExemptFromRootLock(['(manager)', 'clients', 'index'])).toBe(false);
    expect(isExemptFromRootLock(['(manager)', 'team', 'index'])).toBe(false);
  });

  it('does not exempt same-named routes in other role groups', () => {
    expect(isExemptFromRootLock(['(tabs)', 'more', 'clients'])).toBe(false);
    expect(isExemptFromRootLock(['(executive)', 'more', 'clients'])).toBe(false);
  });

  it('does not exempt a segment list shorter than the exempt path', () => {
    expect(isExemptFromRootLock(['(manager)', 'more'])).toBe(false);
    expect(isExemptFromRootLock([])).toBe(false);
  });
});
