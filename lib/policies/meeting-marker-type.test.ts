import { describe, expect, it } from 'vitest';
import { classifyMeetingMarkerType } from './meeting-marker-type';

describe('classifyMeetingMarkerType', () => {
  it('classifies online regardless of location_type', () => {
    expect(classifyMeetingMarkerType('online', null)).toBe('online');
    expect(classifyMeetingMarkerType('online', 'Client Office')).toBe('online');
    expect(classifyMeetingMarkerType('online', 'Others')).toBe('online');
  });

  it('classifies in-person "Others" location as others', () => {
    expect(classifyMeetingMarkerType('in_person', 'Others')).toBe('others');
  });

  it('classifies in-person "Client Office" location as client_office', () => {
    expect(classifyMeetingMarkerType('in_person', 'Client Office')).toBe('client_office');
  });

  it('defaults null/undefined location_type to client_office when not online', () => {
    expect(classifyMeetingMarkerType('in_person', null)).toBe('client_office');
    expect(classifyMeetingMarkerType(undefined, undefined)).toBe('client_office');
  });

  it('falls back to location_type when meeting_mode is missing (pre-migration rows)', () => {
    expect(classifyMeetingMarkerType(null, 'Others')).toBe('others');
    expect(classifyMeetingMarkerType(null, 'Client Office')).toBe('client_office');
  });
});
