import { describe, expect, it } from 'vitest';
import { isQualifyingLocalMeeting, type MeetingCandidateRow } from './policies/cutoff-local-qualification';

const baseMeeting: MeetingCandidateRow = {
  id: 'meeting-1',
  outcome: 'Successful',
  agendas: JSON.stringify(['Close deal']),
  client_status_at_meeting: 'in_progress',
  start_photo_url: 'https://example.test/start.jpg',
  end_photo_url: 'https://example.test/end.jpg',
  start_captured_at: '2026-08-09T01:00:00.000Z',
  po_confirmation_status: null,
};

describe('isQualifyingLocalMeeting', () => {
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

  it.each(['new', 'existing'] as const)('counts a completed %s fast-path visit without an outcome or start photo', (client_status_at_meeting) => {
    expect(
      isQualifyingLocalMeeting({
        ...baseMeeting,
        client_status_at_meeting,
        outcome: null,
        agendas: JSON.stringify(['Introduction']),
        start_photo_url: null,
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
        end_photo_url: null,
      })
    ).toBe(false);
  });
});
