import { describe, expect, it } from 'vitest';
import { buildClientEditRequestRemotePayload } from './client-edit-request-payload';

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
