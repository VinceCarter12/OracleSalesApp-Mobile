// Batch 8 Maps extension (2026-08-04): pure, zero-import classification for
// the Sales/RSR Maps screen's meeting markers. `location_type` alone is NOT
// a reliable 3-way signal — fast-path visits (record-visit.tsx) only ever
// write `'Client Office' | 'Others'`, so a fast-path ONLINE visit is stored
// as `location_type='Others'` (a preexisting quirk, out of scope to fix
// here). `meeting_mode` is set directly from the user's mode selection on
// every recording path (full-form and fast-path alike) and is therefore the
// reliable signal — checked FIRST, before falling back to `location_type`
// for the in-person case.

export type MeetingMarkerType = 'client_office' | 'online' | 'others';

export const MEETING_MARKER_TYPE_LABEL: Record<MeetingMarkerType, string> = {
  client_office: 'Client Office',
  online: 'Online',
  others: 'Others',
};

/**
 * @param meetingMode `meetings.meeting_mode` — `'in_person' | 'online'` or
 *   null/undefined for pre-migration rows.
 * @param locationType `meetings.location_type` — `'Client Office' | 'Online'
 *   | 'Others'` on full-form meetings, `'Client Office' | 'Others'` only on
 *   fast-path meetings, or null.
 */
export function classifyMeetingMarkerType(
  meetingMode: string | null | undefined,
  locationType: string | null | undefined
): MeetingMarkerType {
  if (meetingMode === 'online') return 'online';
  if (locationType === 'Others') return 'others';
  return 'client_office';
}
