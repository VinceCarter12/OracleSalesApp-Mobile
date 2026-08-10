import { describe, expect, it } from 'vitest';
import {
  isDeclareSuccess,
  mapLostOpportunityDeclareCode,
  type LostOpportunityDeclareCode,
} from './lost-opportunity-declare-policy';

const ALL_CODES: LostOpportunityDeclareCode[] = [
  'declared',
  'reason_required',
  'not_found',
  'role_not_eligible',
  'already_lost',
  'pending_edit_request',
  'pending_po_confirmation',
];

describe('mapLostOpportunityDeclareCode', () => {
  it.each(ALL_CODES)('returns a non-empty message for every live Migration 088 code (%s)', (code) => {
    expect(mapLostOpportunityDeclareCode(code).length).toBeGreaterThan(0);
  });

  it("gives pending_edit_request and pending_po_confirmation distinct, specific copy (Vince's 2026-08-11 decision)", () => {
    const editRequest = mapLostOpportunityDeclareCode('pending_edit_request');
    const poConfirmation = mapLostOpportunityDeclareCode('pending_po_confirmation');
    expect(editRequest).not.toBe(poConfirmation);
    expect(editRequest).toMatch(/pagbabago/i);
    expect(poConfirmation).toMatch(/PO confirmation/i);
  });
});

describe('isDeclareSuccess', () => {
  it('is true only for declared', () => {
    expect(isDeclareSuccess('declared')).toBe(true);
  });

  it.each(ALL_CODES.filter((c) => c !== 'declared'))('is false for rejection code %s', (code) => {
    expect(isDeclareSuccess(code)).toBe(false);
  });
});
