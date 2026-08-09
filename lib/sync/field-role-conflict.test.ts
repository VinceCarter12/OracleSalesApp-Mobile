import { describe, expect, it } from 'vitest';

import { isServerOwnedFieldRoleConflict } from './field-role-conflict';

// F-007 (web 070/069/046): only a collection_visits / purchase_orders UPDATE
// whose payload is ENTIRELY server-owned columns should auto-resolve
// server-wins; everything else keeps the normal conflict path.
describe('isServerOwnedFieldRoleConflict', () => {
  it('resolves a claim payload (all claimed_* columns are admin/server-owned)', () => {
    const payload = JSON.stringify({ claimed_by: null, claimed_at: null, claimed_by_name: null });
    expect(isServerOwnedFieldRoleConflict('collection_visits', payload)).toBe(true);
  });

  it('resolves a legacy collect payload (money/status columns the 070 trigger now owns)', () => {
    const payload = JSON.stringify({
      status: 'collected',
      collector_id: 'c1',
      amount_collected: 1100,
      payment_method: 'cash',
      visited_at: '2026-08-09T00:00:00.000Z',
      gps_lat: 14.5,
      gps_lng: 121.0,
    });
    expect(isServerOwnedFieldRoleConflict('collection_visits', payload)).toBe(true);
  });

  it('does NOT resolve a reschedule (rescheduled_to / remarks are collector intent, not server-derived)', () => {
    const payload = JSON.stringify({
      status: 'rescheduled',
      rescheduled_to: '2026-08-12',
      remarks: 'store closed',
    });
    expect(isServerOwnedFieldRoleConflict('collection_visits', payload)).toBe(false);
  });

  it('resolves a purchase_orders claim payload too', () => {
    const payload = JSON.stringify({ claimed_by: 'd1', claimed_at: '2026-08-09T00:00:00.000Z', claimed_by_name: 'Driver' });
    expect(isServerOwnedFieldRoleConflict('purchase_orders', payload)).toBe(true);
  });

  it('never resolves a non-field-role table (e.g. clients — its conflicts are real duplicates)', () => {
    const payload = JSON.stringify({ status: 'active' });
    expect(isServerOwnedFieldRoleConflict('clients', payload)).toBe(false);
  });

  it('returns false for an empty payload (nothing to adopt)', () => {
    expect(isServerOwnedFieldRoleConflict('collection_visits', '{}')).toBe(false);
  });

  it('returns false for an unparseable payload rather than throwing', () => {
    expect(isServerOwnedFieldRoleConflict('collection_visits', 'not json')).toBe(false);
  });
});
