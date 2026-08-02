import { describe, expect, it } from 'vitest';
import { buildClientEditRequestRemotePayload, computeClientEditChanges } from './client-edit-request-payload';

describe('buildClientEditRequestRemotePayload', () => {
  it('builds the exact remote-writable shape, omitting status/reviewed_by/reviewed_at/review_note', () => {
    const payload = buildClientEditRequestRemotePayload({
      id: 'req-1',
      clientId: 'client-1',
      requestedBy: 'agent-1',
      changes: { company_name: { old: 'Old Co', new: 'New Co' } },
      baseUpdatedAt: '2026-08-01T00:00:00.000Z',
      baseAssignedAgentId: 'agent-1',
    });

    expect(payload).toEqual({
      id: 'req-1',
      client_id: 'client-1',
      requested_by: 'agent-1',
      changes: { company_name: { old: 'Old Co', new: 'New Co' } },
      base_updated_at: '2026-08-01T00:00:00.000Z',
      base_assigned_agent_id: 'agent-1',
    });
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('reviewed_by');
    expect(payload).not.toHaveProperty('reviewed_at');
    expect(payload).not.toHaveProperty('review_note');
  });

  it('passes multiple changed fields through unmodified (bundling rule: all changed fields in one request)', () => {
    const changes = {
      company_name: { old: 'A', new: 'B' },
      contact_number: { old: '111', new: '222' },
    };
    const payload = buildClientEditRequestRemotePayload({
      id: 'req-2',
      clientId: 'client-2',
      requestedBy: 'agent-2',
      changes,
      baseUpdatedAt: '2026-08-01T00:00:00.000Z',
      baseAssignedAgentId: 'agent-2',
    });
    expect(payload.changes).toEqual(changes);
  });
});

describe('computeClientEditChanges', () => {
  const ALLOWLIST = ['company_name', 'contact_person', 'office_address', 'minor_notes'] as const;

  it('returns an empty object when nothing in the allowlist changed', () => {
    const before = { company_name: 'Oracle Co', contact_person: 'Juan', office_address: null, minor_notes: null };
    const after = { company_name: 'Oracle Co', contact_person: 'Juan', office_address: null, minor_notes: null };
    expect(computeClientEditChanges(before, after, ALLOWLIST)).toEqual({});
  });

  it('treats "" and null as the same empty value, so an untouched blank field never looks dirty', () => {
    const before = { company_name: 'Oracle Co', contact_person: 'Juan', office_address: null, minor_notes: null };
    const after = { company_name: 'Oracle Co', contact_person: 'Juan', office_address: '', minor_notes: '' };
    expect(computeClientEditChanges(before, after, ALLOWLIST)).toEqual({});
  });

  it('reports only the fields that actually changed, keyed by allowlist field name', () => {
    const before = { company_name: 'Oracle Co', contact_person: 'Juan', office_address: 'Old St', minor_notes: null };
    const after = { company_name: 'Oracle Petroleum', contact_person: 'Juan', office_address: 'Old St', minor_notes: null };
    expect(computeClientEditChanges(before, after, ALLOWLIST)).toEqual({
      company_name: { old: 'Oracle Co', new: 'Oracle Petroleum' },
    });
  });

  it('ignores fields outside the given allowlist even if they differ', () => {
    const before = { company_name: 'Oracle Co', sales_channel: 'distributor' };
    const after = { company_name: 'Oracle Co', sales_channel: 'dealer' };
    expect(computeClientEditChanges(before, after, ['company_name'])).toEqual({});
  });

  it('bundles multiple changed fields into one diff (one save = one request = one bundled diff)', () => {
    const before = { company_name: 'Oracle Co', contact_person: 'Juan', office_address: 'Old St', minor_notes: null };
    const after = { company_name: 'Oracle Petroleum', contact_person: 'Pedro', office_address: 'Old St', minor_notes: null };
    expect(computeClientEditChanges(before, after, ALLOWLIST)).toEqual({
      company_name: { old: 'Oracle Co', new: 'Oracle Petroleum' },
      contact_person: { old: 'Juan', new: 'Pedro' },
    });
  });
});
