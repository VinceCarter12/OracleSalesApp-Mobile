import { describe, expect, it } from 'vitest';
import { rowToMeeting, type LocalMeetingRow } from './local-meeting-mapper';

/**
 * Lost Opportunity history (SQLite v31): a meeting carries the client's name in
 * two possible places — `joined_client_name` from `JOIN clients` at read time,
 * and `client_name` snapshotted onto the meeting row when a lost/deleted client
 * was removed from this device. These cover the precedence between them, which
 * is the whole reason the agent's history survives the client going lost.
 */
function row(overrides: Partial<LocalMeetingRow> = {}): LocalMeetingRow {
  return {
    id: 'meeting-1',
    client_id: 'client-1',
    agent_id: 'agent-1',
    gps_lat: 14.5547,
    gps_lng: 121.0244,
    selfie_url: null,
    agendas: '[]',
    outcome: 'lost_opportunity',
    meeting_mode: 'in_person',
    start_photo_url: null,
    start_captured_at: null,
    end_photo_url: null,
    end_captured_at: null,
    logged_at: '2026-08-10T09:32:41.094Z',
    created_at: '2026-08-10T09:32:41.094Z',
    contact_person: null,
    contact_position: null,
    location_type: null,
    location_name: null,
    remarks: null,
    sync_status: 'synced',
    ...overrides,
  };
}

describe('rowToMeeting — client name resolution', () => {
  it('prefers the joined live name, so a renamed client reads correctly', () => {
    const meeting = rowToMeeting(
      row({ joined_client_name: 'Oracle Petroleum (renamed)', client_name: 'Oracle Petroleum' })
    );
    expect(meeting.client_name).toBe('Oracle Petroleum (renamed)');
  });

  it('falls back to the snapshot once the client row is gone', () => {
    // The state after removeLostOrDeletedClient(): no clients row left to join,
    // so the LEFT JOIN yields null and only the stamped name remains. Before
    // v31 this meeting was filtered out of the list entirely.
    const meeting = rowToMeeting(row({ joined_client_name: null, client_name: 'Original oracle petroleum' }));
    expect(meeting.client_name).toBe('Original oracle petroleum');
  });

  it('is null when neither name is present rather than undefined', () => {
    const meeting = rowToMeeting(row({ client_id: null }));
    expect(meeting.client_name).toBeNull();
  });

  it('reads the snapshot on a row predating the join alias', () => {
    // `joined_client_name` absent entirely (not null) — SQLite returns
    // undefined for a column a query never selected.
    const meeting = rowToMeeting(row({ client_name: 'Ss' }));
    expect(meeting.client_name).toBe('Ss');
  });
});
