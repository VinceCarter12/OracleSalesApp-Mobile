import { describe, expect, it } from 'vitest';
import { buildHeldWriteInput, splitCompleteInfoChanges, type CompleteInfoFormValues } from './complete-info-field-split';
import type { Client } from '../types';

// Per-field approval gating (2026-08-11, fixes B-10x): splitCompleteInfoChanges
// is the single source of truth both the screen and submitCompleteInfo() rely
// on. These tests cover the split itself, independent of the branch mapping
// (already covered by complete-info-branch.test.ts).

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

describe('splitCompleteInfoChanges', () => {
  it('first save on a completely blank client: every changed field is direct-apply (nothing to protect yet)', () => {
    const client = makeClient();
    const form = makeForm({
      contactPerson: 'Juan Dela Cruz',
      contactNumber: '09171234567',
      officeAddress: 'Manila',
      channel: 'Dealer',
    });

    const split = splitCompleteInfoChanges(client, form);

    expect(split.approvalRequiredFields).toEqual([]);
    expect(split.directApplyFields.sort()).toEqual(
      ['contact_person', 'contact_number', 'office_address', 'sales_channel'].sort()
    );
  });

  it('filling the one remaining blank field on an otherwise-complete client is direct-apply only for that field', () => {
    const client = makeClient({
      contact_person: 'Juan Dela Cruz',
      contact_number: '09171234567',
      sales_channel: 'Dealer',
      office_address: null, // the one still-blank field
    });
    const form = makeForm({
      contactPerson: 'Juan Dela Cruz',
      contactNumber: '09171234567',
      channel: 'Dealer',
      officeAddress: 'Manila', // now filled in for the first time
    });

    const split = splitCompleteInfoChanges(client, form);

    expect(split.directApplyFields).toEqual(['office_address']);
    expect(split.approvalRequiredFields).toEqual([]);
  });

  it('re-editing an already-set field requires approval, even while a still-blank field is filled in the same save', () => {
    const client = makeClient({
      contact_person: 'Juan Dela Cruz',
      contact_number: '09171234567',
      sales_channel: 'Dealer',
      office_address: null,
    });
    const form = makeForm({
      contactPerson: 'Juan Dela Cruz',
      contactNumber: '09998887777', // changing an already-set field
      channel: 'Dealer',
      officeAddress: 'Manila', // first-time fill, bundled in the same save
    });

    const split = splitCompleteInfoChanges(client, form);

    expect(split.directApplyFields).toEqual(['office_address']);
    expect(split.approvalRequiredFields).toEqual(['contact_number']);
  });

  it('minor_notes is always direct-apply, even alongside an approval-required change', () => {
    const client = makeClient({
      contact_person: 'Juan Dela Cruz',
      contact_number: '09171234567',
      sales_channel: 'Dealer',
      office_address: 'Manila',
      minor_notes: null,
    });
    const form = makeForm({
      contactPerson: 'Juan Dela Cruz',
      contactNumber: '09998887777', // approval-required
      channel: 'Dealer',
      officeAddress: 'Manila',
      minorNotes: 'internal note',
    });

    const split = splitCompleteInfoChanges(client, form);

    expect(split.directApplyFields).toEqual(['minor_notes']);
    expect(split.approvalRequiredFields).toEqual(['contact_number']);
  });

  it('customer_type (status) is never blank-before, so changing it (existingOverride) always requires approval', () => {
    const client = makeClient({ status: 'new', sales_channel: 'Distributor' });
    const form = makeForm({ existingOverride: true });

    const split = splitCompleteInfoChanges(client, form);

    expect(split.approvalRequiredFields).toEqual(['customer_type']);
    expect(split.directApplyFields).toEqual([]);
  });

  it('a save with nothing changed produces an empty split', () => {
    const client = makeClient({
      contact_person: 'Juan Dela Cruz',
      contact_number: '09171234567',
      sales_channel: 'Dealer',
      office_address: 'Manila',
    });
    const form = makeForm({
      contactPerson: 'Juan Dela Cruz',
      contactNumber: '09171234567',
      channel: 'Dealer',
      officeAddress: 'Manila',
    });

    const split = splitCompleteInfoChanges(client, form);

    expect(split.directApplyFields).toEqual([]);
    expect(split.approvalRequiredFields).toEqual([]);
  });
});

describe('buildHeldWriteInput', () => {
  it('holds an approval-required field at its OLD client value and writes a directApplyFields field with its NEW form value', () => {
    const client = makeClient({
      contact_person: '', // blank before — first-time fill
      sales_channel: 'Dealer', // already-set — held for approval
    });
    const form = makeForm({
      contactPerson: 'Juan Dela Cruz',
      channel: 'Distributor',
    });

    const write = buildHeldWriteInput(client, form, ['sales_channel']);

    expect(write.contactPerson).toBe('Juan Dela Cruz'); // NEW — not approval-required
    expect(write.salesChannel).toBe('Dealer'); // OLD — held
  });

  it('holds contact_position/contact_number/office_address/minor_notes at their OLD values when each is individually approval-required', () => {
    const client = makeClient({
      position: 'Manager',
      contact_number: '09171234567',
      office_address: 'Manila',
      minor_notes: 'old note',
    });
    const form = makeForm({
      position: 'Director',
      contactNumber: '09998887777',
      officeAddress: 'Cebu',
      minorNotes: 'new note',
    });

    const write = buildHeldWriteInput(client, form, [
      'contact_position',
      'contact_number',
      'office_address',
      'minor_notes',
    ]);

    expect(write.position).toBe('Manager');
    expect(write.contactNumber).toBe('09171234567');
    expect(write.officeAddress).toBe('Manila');
    expect(write.minorNotes).toBe('old note');
  });

  it('omits markExisting (undefined) when customer_type is approval-required, even if the form toggled existingOverride', () => {
    const client = makeClient({ status: 'new' });
    const form = makeForm({ existingOverride: true });

    const write = buildHeldWriteInput(client, form, ['customer_type']);

    expect(write.markExisting).toBeUndefined();
  });

  it('applies markExisting when customer_type is NOT approval-required and the form toggled existingOverride', () => {
    const client = makeClient({ status: 'new' });
    const form = makeForm({ existingOverride: true });

    const write = buildHeldWriteInput(client, form, []);

    expect(write.markExisting).toBe(true);
  });
});
