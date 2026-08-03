import { describe, expect, it } from 'vitest';
import { buildMeetingRecord, type MeetingStartCapture } from './meeting-record-assembler';
import type { CompanionSelection } from './tag-along-service';

const START: MeetingStartCapture = { capturedAt: '2026-08-02T09:00:00.000Z', gpsLat: 14.5995, gpsLng: 120.9842 };

const COMPANIONS: CompanionSelection[] = [
  { profileId: 'mgr-1', kind: 'manager' },
  { profileId: 'peer-1', kind: 'teammate' },
];

const COMMON = {
  clientId: 'client-1',
  agentId: 'agent-1',
  authUserId: 'auth-uid-1',
  start: START,
  mode: 'in_person' as const,
  agendas: ['Product / company presentation'],
  companions: COMPANIONS,
  companionsPreAccepted: false,
};

describe('buildMeetingRecord — RT-A1/A2: full-form vs fast-path parity for otherwise-equivalent input', () => {
  it('produces the same identity/attribution/companion shape for equivalent full-form and fast-path input', () => {
    const full = buildMeetingRecord({
      ...COMMON,
      flow: 'full',
      selfieUri: 'file://selfie.jpg',
      outcome: 'Successful',
      contactName: 'Juan',
      contactPosition: 'Owner',
      meetingLocation: 'Client Office',
      otherLocation: '',
      remarks: '',
      poEvidence: null,
    });
    const visit = buildMeetingRecord({
      ...COMMON,
      flow: 'visit',
      endPhoto: { uri: 'file://end.jpg', capturedAt: '2026-08-02T09:30:00.000Z', gpsLat: 14.6, gpsLng: 120.99 },
    });

    // Same client/agent identity and the same locked-in Start GPS/timestamp.
    expect(full.client_id).toBe(visit.client_id);
    expect(full.agent_id).toBe(visit.agent_id);
    expect(full.gps_lat).toBe(visit.gps_lat);
    expect(full.gps_lng).toBe(visit.gps_lng);
    expect(full.start_captured_at).toBe(visit.start_captured_at);
    expect(full.logged_at).toBe(visit.logged_at);
    // Same companion selection shape (RT-A3/A4, see below for the count assertion).
    expect(full.companions).toEqual(visit.companions);
    expect(full.companionsPreAccepted).toBe(visit.companionsPreAccepted);
    // Both an in-person 'Client Office' meeting: both auto-capture the office pin.
    expect(full.captureOfficePin).toBe(true);
    expect(visit.captureOfficePin).toBe(true);
  });

  it('fast-path is structurally incapable of producing PO evidence — outcome is always null and there is no outcome/poEvidence input field for that flow', () => {
    const visit = buildMeetingRecord({
      ...COMMON,
      flow: 'visit',
      endPhoto: { uri: 'file://end.jpg', capturedAt: '2026-08-02T09:30:00.000Z', gpsLat: 14.6, gpsLng: 120.99 },
    });
    expect(visit.outcome).toBeNull();
    expect(visit.poEvidence).toBeUndefined();
  });
});

describe('buildMeetingRecord — RT-A3/A4: companions survive into exactly one selection per companion', () => {
  it('full-form: exactly one CompanionSelection per selected companion, no duplication', () => {
    const record = buildMeetingRecord({
      ...COMMON,
      flow: 'full',
      selfieUri: 'file://selfie.jpg',
      outcome: 'Successful',
      contactName: '',
      contactPosition: '',
      meetingLocation: 'Client Office',
      otherLocation: '',
      remarks: '',
      poEvidence: null,
    });
    expect(record.companions).toHaveLength(COMPANIONS.length);
    expect(record.companions).toEqual(COMPANIONS);
  });

  it('fast-path: exactly one CompanionSelection per selected companion, no duplication', () => {
    const record = buildMeetingRecord({
      ...COMMON,
      flow: 'visit',
      endPhoto: { uri: 'file://end.jpg', capturedAt: '2026-08-02T09:30:00.000Z', gpsLat: 14.6, gpsLng: 120.99 },
    });
    expect(record.companions).toHaveLength(COMPANIONS.length);
    expect(record.companions).toEqual(COMPANIONS);
  });
});

describe('buildMeetingRecord — RT-A5: Start GPS/timestamp attribution is locked at Start, not re-derived from later fields', () => {
  it('full-form: gps/start_captured_at/logged_at come only from `start`, unaffected by other edited fields', () => {
    const recordA = buildMeetingRecord({
      ...COMMON,
      flow: 'full',
      selfieUri: 'file://selfie.jpg',
      outcome: 'Successful',
      contactName: 'A',
      contactPosition: 'A',
      meetingLocation: 'Client Office',
      otherLocation: '',
      remarks: 'first remark',
      poEvidence: null,
    });
    const recordB = buildMeetingRecord({
      ...COMMON,
      flow: 'full',
      selfieUri: 'file://different-selfie.jpg',
      outcome: 'Follow-up Required',
      contactName: 'B — edited later',
      contactPosition: 'B — edited later',
      meetingLocation: 'Others',
      otherLocation: 'Starbucks Alabang',
      remarks: 'a completely different remark',
      poEvidence: null,
    });
    // Every later-edited field differs between A and B, but the Start
    // attribution triple must be identical — it's sourced only from `start`.
    expect(recordA.gps_lat).toBe(START.gpsLat);
    expect(recordA.gps_lng).toBe(START.gpsLng);
    expect(recordA.start_captured_at).toBe(START.capturedAt);
    expect(recordA.logged_at).toBe(START.capturedAt);
    expect(recordB.gps_lat).toBe(recordA.gps_lat);
    expect(recordB.gps_lng).toBe(recordA.gps_lng);
    expect(recordB.start_captured_at).toBe(recordA.start_captured_at);
    expect(recordB.logged_at).toBe(recordA.logged_at);
  });

  it('fast-path: gps/start_captured_at/logged_at come only from `start`, not from the later end-photo capture', () => {
    const record = buildMeetingRecord({
      ...COMMON,
      flow: 'visit',
      endPhoto: {
        uri: 'file://end.jpg',
        // Deliberately a different GPS/time than `start` — must never leak
        // into gps_lat/gps_lng/start_captured_at/logged_at.
        capturedAt: '2026-08-02T11:45:00.000Z',
        gpsLat: 15.1,
        gpsLng: 121.5,
      },
    });
    expect(record.gps_lat).toBe(START.gpsLat);
    expect(record.gps_lng).toBe(START.gpsLng);
    expect(record.start_captured_at).toBe(START.capturedAt);
    expect(record.logged_at).toBe(START.capturedAt);
    expect(record.end_gps_lat).toBe(15.1);
    expect(record.end_gps_lng).toBe(121.5);
  });
});
