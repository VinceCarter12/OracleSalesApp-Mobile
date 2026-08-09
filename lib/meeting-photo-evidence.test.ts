import { describe, expect, it } from 'vitest';
import { mapMeetingPhotoEvidence } from './meeting-photo-evidence';
import type { Meeting } from '../types';

const meeting = {
  id: 'm1', client_id: 'c1', agent_id: 'a1', gps_lat: 14.6, gps_lng: 120.9, selfie_url: 'file://selfie',
  agendas: [], outcome: null, logged_at: '2026-08-09T01:00:00.000Z', created_at: '2026-08-09T01:00:00.000Z',
  end_captured_at: '2026-08-09T02:00:00.000Z', end_gps_lat: 14.7, end_gps_lng: 121.0, client_status_at_meeting: 'prospect',
} satisfies Meeting;

describe('mapMeetingPhotoEvidence', () => {
  it('does not borrow save-time GPS/time for a selfie with no persisted metadata', () => {
    expect(mapMeetingPhotoEvidence(meeting, 'selfie')).toMatchObject({ uri: 'file://selfie', gpsLat: null, capturedAt: null, clientStatusLabel: 'Prospect' });
  });
  it('uses exact locally persisted selfie evidence when present', () => {
    expect(mapMeetingPhotoEvidence({ ...meeting, selfie_captured_at: '2026-08-09T01:30:00.000Z', selfie_gps_lat: 14.65, selfie_gps_lng: 120.95 }, 'selfie')).toMatchObject({ gpsLat: 14.65, gpsLng: 120.95, capturedAt: '2026-08-09T01:30:00.000Z' });
  });
  it('does not substitute current status for legacy records', () => {
    expect(mapMeetingPhotoEvidence({ ...meeting, client_status_at_meeting: null }, 'selfie').clientStatusLabel).toContain('unavailable');
  });
});
