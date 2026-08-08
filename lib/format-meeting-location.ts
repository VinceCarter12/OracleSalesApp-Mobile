import type { Meeting } from '../types';

/**
 * Meeting's `location_type`/`location_name` → the wireframe's human-readable
 * Location line. `location_type` is stored locally as the literal wireframe
 * label ('Client Office' | 'Online' | 'Others', see
 * lib/meeting-service.ts's `locationType`), so it's echoed as-is except for
 * 'Others', which falls back to the free-text `location_name`. Shared by
 * app/(tabs)/meetings/index.tsx and app/(tabs)/meetings/[id].tsx so a fix in
 * one can never drift from the other again (2026-08-04: they previously had
 * separate copies, and only one got the 'Online' fix).
 */
export function formatMeetingLocation(meeting: Meeting): string | null {
  if (!meeting.location_type) return null;
  if (meeting.location_type === 'Others') return meeting.location_name || 'Others';
  return meeting.location_type;
}
