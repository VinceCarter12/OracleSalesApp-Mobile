import { describe, expect, it } from 'vitest';
import { buildRemoteMeetingPayload } from './remote-meeting-payload';
import type { NewMeetingRecord } from './meeting-service';

// B-083 fix: confirms the remote upsert payload carries BOTH the legacy
// label array (`agenda`, unchanged) AND the new canonical `agenda_ids` this
// bug fix adds — `advance_prospect_to_in_progress()` (Migration 043) reads
// only the latter.
function baseRecord(overrides: Partial<NewMeetingRecord> = {}): NewMeetingRecord {
  return {
    client_id: 'client-1',
    agent_id: 'agent-1',
    gps_lat: 14.6,
    gps_lng: 121.0,
    meeting_mode: 'in_person',
    agendas: ['Relationship building', 'Close deal'],
    outcome: 'Successful',
    logged_at: '2026-07-29T09:00:00.000Z',
    ...overrides,
  };
}

describe('buildRemoteMeetingPayload', () => {
  it('includes both the legacy label array and the resolved canonical agenda_ids', () => {
    const payload = buildRemoteMeetingPayload('meeting-1', baseRecord(), ['relationship_building', 'close_deal']);
    expect(payload.agenda).toEqual(['Relationship building', 'Close deal']);
    expect(payload.agenda_ids).toEqual(['relationship_building', 'close_deal']);
  });

  it('sends an empty agenda_ids array when no agenda resolved to a canonical id', () => {
    const payload = buildRemoteMeetingPayload('meeting-1', baseRecord({ agendas: [] }), []);
    expect(payload.agenda_ids).toEqual([]);
  });

  it('still maps outcome/meeting_type/contact_person as before (unaffected by the B-083 fix)', () => {
    const payload = buildRemoteMeetingPayload('meeting-1', baseRecord({ contactPerson: '  Juan Dela Cruz  ' }), [
      'relationship_building',
    ]);
    expect(payload.outcome).toBe('successful');
    expect(payload.meeting_type).toBe('f2f');
    expect(payload.contact_person).toBe('Juan Dela Cruz');
  });
});
