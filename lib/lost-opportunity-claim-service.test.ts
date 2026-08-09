import { describe, expect, it } from 'vitest';
import { decodeClaimRpcResult, parseFreshProspectId } from './lost-opportunity-claim-payload';

describe('parseFreshProspectId', () => {
  it('accepts a redacted fresh prospect returned by the replacement RPC', () => {
    expect(parseFreshProspectId({
      id: 'fresh-client',
      company_name: 'Acme',
      city: 'Manila',
      status: 'active',
      customer_type: 'prospect',
    })).toBe('fresh-client');
  });

  it('rejects the legacy same-client payload that retains history', () => {
    expect(parseFreshProspectId({
      id: 'old-client',
      status: 'active',
      customer_type: 'prospect',
      contact_person: 'Former contact',
    })).toBeNull();
  });

  it('rejects missing or malformed payloads', () => {
    expect(parseFreshProspectId(null)).toBeNull();
    expect(parseFreshProspectId({ id: 'x', status: 'active' })).toBeNull();
  });

  it('rejects unknown payload keys and malformed RPC roots', () => {
    expect(parseFreshProspectId({ id: 'x', company_name: 'A', city: 'M', status: 'active', customer_type: 'prospect', contact_person: 'leak' })).toBeNull();
    expect(() => decodeClaimRpcResult(null)).toThrow();
    expect(() => decodeClaimRpcResult({ code: 'unknown' })).toThrow();
  });
});
