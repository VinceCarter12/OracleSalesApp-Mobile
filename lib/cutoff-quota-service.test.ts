import { describe, expect, it } from 'vitest';
import { isQualifyingLocalMeeting, type MeetingCandidateRow } from './policies/cutoff-local-qualification';

const baseMeeting: MeetingCandidateRow = {
  id: 'meeting-1',
  outcome: 'Successful',
  agendas: JSON.stringify(['Close deal']),
  client_status_at_meeting: 'in_progress',
  start_photo_url: null,
  end_photo_url: 'https://example.test/end.jpg',
  // The evidence the server actually checks: `selfie_url` here is
  // `meetings.photo_url` there (lib/sync/photo-upload-registry.ts). This
  // fixture used to set `start_photo_url` and leave the selfie null, which is
  // a shape the app never produces — nothing writes start_photo_url.
  selfie_url: 'https://example.test/selfie.jpg',
  start_captured_at: '2026-08-09T01:00:00.000Z',
  po_confirmation_status: null,
};

describe('isQualifyingLocalMeeting', () => {
  it('counts a completed No Decision meeting because quota tracks meetings, not only wins', () => {
    expect(isQualifyingLocalMeeting({ ...baseMeeting, outcome: 'No Decision' })).toBe(true);
  });

  it('still excludes a completed Lost Opportunity meeting', () => {
    expect(isQualifyingLocalMeeting({ ...baseMeeting, outcome: 'Lost Opportunity' })).toBe(false);
  });

  it.each(['draft', 'superseded', null])(
    'excludes an In Progress Close deal meeting when PO status is %s',
    (po_confirmation_status) => {
      expect(isQualifyingLocalMeeting({ ...baseMeeting, po_confirmation_status })).toBe(false);
    }
  );

  it.each(['pending', 'approved', 'rejected', 'cancelled'])('counts an In Progress Close deal meeting when PO is %s', (po_confirmation_status) => {
    expect(isQualifyingLocalMeeting({ ...baseMeeting, po_confirmation_status })).toBe(true);
  });

  it('does not add the PO gate to other meeting types', () => {
    expect(
      isQualifyingLocalMeeting({
        ...baseMeeting,
        client_status_at_meeting: 'prospect',
        po_confirmation_status: null,
      })
    ).toBe(true);
  });

  it('counts a full-form meeting whose only photo evidence is the selfie, the shape the app actually produces', () => {
    // Regression: the rule used to demand `start_photo_url`, which no upload
    // kind ever writes, so this returned false for every real meeting and the
    // pending chip could never leave 0 while the server counted the same
    // meeting as confirmed.
    expect(
      isQualifyingLocalMeeting({
        ...baseMeeting,
        client_status_at_meeting: 'prospect',
        start_photo_url: null,
        end_photo_url: null,
      })
    ).toBe(true);
  });

  it('does not count a full-form meeting with no selfie, matching the server refusing it for a null photo_url', () => {
    expect(
      isQualifyingLocalMeeting({
        ...baseMeeting,
        client_status_at_meeting: 'prospect',
        selfie_url: null,
      })
    ).toBe(false);
  });

  it.each(['new', 'existing'] as const)('counts a completed %s fast-path visit without an outcome or start photo', (client_status_at_meeting) => {
    expect(
      isQualifyingLocalMeeting({
        ...baseMeeting,
        client_status_at_meeting,
        outcome: null,
        agendas: JSON.stringify(['Introduction']),
        start_photo_url: null,
        selfie_url: null,
        end_photo_url: 'file:///meeting-end.jpg',
        po_confirmation_status: null,
      })
    ).toBe(true);
  });

  it('does not count an incomplete new/existing fast-path visit without the end photo', () => {
    expect(
      isQualifyingLocalMeeting({
        ...baseMeeting,
        client_status_at_meeting: 'new',
        outcome: null,
        start_photo_url: null,
        selfie_url: null,
        end_photo_url: null,
      })
    ).toBe(false);
  });
});
