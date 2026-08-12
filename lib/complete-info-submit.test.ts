import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../types';
import type { CompleteInfoFormValues } from './complete-info-field-split';

// lib/client-service.ts and lib/client-edit-request-service.ts both
// transitively import expo-sqlite (a native module vitest's node environment
// can't parse — see complete-info-field-split.ts's header) — mocked the same
// way lib/client-edit-decision-service.test.ts mocks lib/supabase.ts, so
// submitCompleteInfo()'s actual per-field write-splitting logic (not just
// the pure branch/split helpers already covered elsewhere) gets real
// coverage.
const updateClientInfo = vi.fn((_input: Record<string, unknown>) => Promise.resolve());
const createClientEditRequest = vi.fn((_clientId: string, _requesterId: string, _changes: Record<string, unknown>) =>
  Promise.resolve()
);

vi.mock('./client-service', () => ({
  updateClientInfo: (input: Record<string, unknown>) => updateClientInfo(input),
}));

vi.mock('./client-edit-request-service', () => ({
  createClientEditRequest: (clientId: string, requesterId: string, changes: Record<string, unknown>) =>
    createClientEditRequest(clientId, requesterId, changes),
}));

const { submitCompleteInfo } = await import('./complete-info-submit');

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    company_name: 'Acme Corp',
    contact_person: '',
    position: null,
    contact_number: null,
    office_address: null,
    customer_type: 'Dealer',
    sales_channel: null,
    status: 'prospect',
    agent_id: 'agent-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeForm(overrides: Partial<CompleteInfoFormValues> = {}): CompleteInfoFormValues {
  return {
    contactPerson: '',
    position: '',
    contactNumber: '',
    officeAddress: '',
    channel: 'Distributor',
    existingOverride: false,
    minorNotes: '',
    ...overrides,
  };
}

beforeEach(() => {
  updateClientInfo.mockClear();
  createClientEditRequest.mockClear();
});

describe('submitCompleteInfo — request_approval field-write splitting', () => {
  it('mixed blank+already-set fields: direct write carries the NEW blank-filled field but the OLD already-set field, and the edit request holds only the already-set field', async () => {
    const client = makeClient({
      contact_person: '', // blank before — first-time fill, direct
      contact_number: '09171234567',
      sales_channel: 'Dealer', // already-set — changing it needs approval
      office_address: 'Manila',
    });
    const form = makeForm({
      contactPerson: 'Juan Dela Cruz', // filled in for the first time
      contactNumber: '09171234567',
      channel: 'Distributor', // changed from Dealer — approval-required
      officeAddress: 'Manila',
    });

    const branch = await submitCompleteInfo({
      client,
      clientId: 'client-1',
      profileId: 'agent-1',
      pendingRequest: null,
      isManagerOwnClient: false,
      form,
    });

    expect(branch).toBe('request_approval');

    expect(updateClientInfo).toHaveBeenCalledTimes(1);
    expect(updateClientInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        agentId: 'agent-1',
        contactPerson: 'Juan Dela Cruz', // NEW value — was blank
        salesChannel: 'Dealer', // OLD value — held for approval
      })
    );

    expect(createClientEditRequest).toHaveBeenCalledTimes(1);
    const changes = createClientEditRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(Object.keys(changes)).toEqual(['sales_channel']);
  });

  it('customer_type toggle (existingOverride) alongside another already-set field change: both fields are held, neither is written directly', async () => {
    const client = makeClient({
      contact_person: 'Juan Dela Cruz',
      contact_number: '09171234567',
      sales_channel: 'Dealer',
      office_address: 'Manila',
      status: 'new',
    });
    const form = makeForm({
      contactPerson: 'Juan Dela Cruz',
      contactNumber: '09998887777', // changed, already-set — approval-required
      channel: 'Dealer',
      officeAddress: 'Manila',
      existingOverride: true, // customer_type change — also approval-required
    });

    const branch = await submitCompleteInfo({
      client,
      clientId: 'client-1',
      profileId: 'agent-1',
      pendingRequest: null,
      isManagerOwnClient: false,
      form,
    });

    expect(branch).toBe('request_approval');

    // Nothing in this save is direct-apply (both changed fields are
    // already-set) — updateClientInfo is never called, only the edit
    // request captures both held fields.
    expect(updateClientInfo).not.toHaveBeenCalled();

    expect(createClientEditRequest).toHaveBeenCalledTimes(1);
    const changes = createClientEditRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(Object.keys(changes).sort()).toEqual(['contact_number', 'customer_type']);
  });

  it('manager-owns-client with an approval-required field present takes the direct_manager_owns path: everything applied directly, no client_edit_requests row', async () => {
    const client = makeClient({
      contact_person: 'Juan Dela Cruz',
      contact_number: '09171234567',
      sales_channel: 'Dealer',
      office_address: 'Manila',
    });
    const form = makeForm({
      contactPerson: 'Juan Dela Cruz',
      contactNumber: '09998887777', // changed, already-set — would need approval for a non-manager
      channel: 'Dealer',
      officeAddress: 'Manila',
    });

    const branch = await submitCompleteInfo({
      client,
      clientId: 'client-1',
      profileId: 'manager-1',
      pendingRequest: null,
      isManagerOwnClient: true,
      form,
    });

    expect(branch).toBe('direct_manager_owns');

    expect(updateClientInfo).toHaveBeenCalledTimes(1);
    expect(updateClientInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        agentId: 'manager-1',
        contactNumber: '09998887777', // NEW value — applied directly, not held
      })
    );

    expect(createClientEditRequest).not.toHaveBeenCalled();
  });
});
