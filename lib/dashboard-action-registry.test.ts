import { describe, expect, it } from 'vitest';
import { getDashboardActionHref, isDashboardActionAllowed } from './dashboard-action-registry';

describe('dashboard-action-registry', () => {
  it('resolves an href for an authorized role', () => {
    expect(getDashboardActionHref('create-client', 'sales_specialist')).toBe('/(tabs)/clients/create');
    expect(getDashboardActionHref('manager-approvals', 'sales_manager')).toBe('/(manager)/approvals');
    expect(getDashboardActionHref('executive-teams', 'executive')).toBe('/(executive)/teams');
  });

  it('throws for a role not authorized for that action', () => {
    expect(() => getDashboardActionHref('manager-approvals', 'sales_specialist')).toThrow();
    expect(() => getDashboardActionHref('create-client', 'executive')).toThrow();
  });

  it('throws for a null role (session not loaded yet)', () => {
    expect(() => getDashboardActionHref('my-clients', null)).toThrow();
  });

  it('isDashboardActionAllowed mirrors the same authorization rules without throwing', () => {
    expect(isDashboardActionAllowed('manager-team', 'sales_manager')).toBe(true);
    expect(isDashboardActionAllowed('manager-team', 'rsr')).toBe(false);
    expect(isDashboardActionAllowed('manager-team', null)).toBe(false);
  });
});
