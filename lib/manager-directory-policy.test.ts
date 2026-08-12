import { describe, expect, it } from 'vitest';
import { canReadManagerDirectory } from './manager-directory-policy';

describe('manager directory visibility', () => {
  it.each(['sales_specialist', 'rsr'] as const)('allows %s', (role) => {
    expect(canReadManagerDirectory(role)).toBe(true);
  });

  it.each(['superadmin', 'admin', 'sales_manager', 'collector'] as const)('denies %s', (role) => {
    expect(canReadManagerDirectory(role)).toBe(false);
  });

  it('denies an absent profile role', () => {
    expect(canReadManagerDirectory(null)).toBe(false);
  });
});
