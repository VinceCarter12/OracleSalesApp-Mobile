import { describe, expect, it } from 'vitest';

import { isOpenForDelivery, remainingCod, type DeliveryPo } from './collection-delivery-data';

// F-007 Delivery partial COD (web 073): the pure helpers that drive the
// "stays open with a carried balance" display + top-up math.
describe('remainingCod', () => {
  it('is the full COD due on a fresh PO (nothing collected yet)', () => {
    expect(remainingCod({ codDue: 10000, codAmount: undefined })).toBe(10000);
  });

  it('carries the balance down after a partial payment', () => {
    expect(remainingCod({ codDue: 10000, codAmount: 4000 })).toBe(6000);
  });

  it('never goes negative on an over-payment', () => {
    expect(remainingCod({ codDue: 10000, codAmount: 12000 })).toBe(0);
  });

  it('is 0 when there is no COD due', () => {
    expect(remainingCod({ codDue: undefined, codAmount: undefined })).toBe(0);
  });
});

describe('isOpenForDelivery', () => {
  it.each(['pending', 'partial'] as DeliveryPo['status'][])('keeps %s open on the list', (status) => {
    expect(isOpenForDelivery(status)).toBe(true);
  });

  it.each(['delivered', 'failed'] as DeliveryPo['status'][])('treats %s as closed', (status) => {
    expect(isOpenForDelivery(status)).toBe(false);
  });
});
