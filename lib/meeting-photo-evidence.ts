import type { ClientStatus, Meeting } from '../types';

export interface MeetingPhotoEvidence {
  uri: string | null;
  capturedAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  clientStatusAtMeeting: ClientStatus | null;
  clientStatusLabel: string;
}

const STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: 'Prospect',
  in_progress: 'In Progress',
  new: 'New',
  existing: 'Existing',
  inactive: 'Inactive',
};

export function clientStatusAtMeetingLabel(status: ClientStatus | null | undefined): string {
  return status ? STATUS_LABELS[status] : 'Status unavailable (legacy record)';
}

export function mapMeetingPhotoEvidence(meeting: Meeting, photo: 'selfie' | 'start' | 'end'): MeetingPhotoEvidence {
  const isStart = photo === 'start';
  const uri = photo === 'selfie' ? meeting.selfie_url : isStart ? meeting.start_photo_url ?? null : meeting.end_photo_url ?? null;
  // Full-form selfie metadata was never persisted separately from the image;
  // do not borrow end/save GPS or timestamp and imply a false binding.
  const capturedAt = photo === 'selfie' ? meeting.selfie_captured_at ?? null : isStart ? meeting.start_captured_at ?? null : meeting.end_captured_at ?? null;
  const gpsLat = photo === 'selfie' ? meeting.selfie_gps_lat ?? null : isStart ? meeting.gps_lat : meeting.end_gps_lat ?? null;
  const gpsLng = photo === 'selfie' ? meeting.selfie_gps_lng ?? null : isStart ? meeting.gps_lng : meeting.end_gps_lng ?? null;
  const status = meeting.client_status_at_meeting ?? null;
  return { uri, capturedAt, gpsLat, gpsLng, clientStatusAtMeeting: status, clientStatusLabel: clientStatusAtMeetingLabel(status) };
}
