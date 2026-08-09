import { BIZLINK_COLORS } from './theme';
import type { ClientStatus } from '../types';

/**
 * 2026-08-08 Vince direction: the map pins (app/(tabs)/more/maps.tsx + its
 * MapLegend) should NOT reuse the status *badge* text colors like the earlier
 * implementation did — the badge set (navy/amber/dark-green/gray) reads
 * poorly as pins on a map. This module owns the dedicated marker palette.
 *
 * - Office pin            → green  (BIZLINK_COLORS.brand)
 * - Prospect meeting      → purple
 * - In Progress meeting   → orange
 * - New meeting           → blue
 * - Existing meeting      → teal
 * - Inactive (never a filter on the agent map) → neutral gray fallback
 */
export const MAP_OFFICE_PIN_COLOR = BIZLINK_COLORS.brand;

/**
 * Manager Maps only (Wireframe-Manager-BizLink.html `#s-maps`, line ~809:
 * `<span><i style="background:var(--navy)"></i> Team record</span>`) — a
 * teammate's office pin/meeting marker (not the manager's own) is rendered
 * navy instead of the status color, so "My Team"/"Combined" scope visibly
 * distinguishes team-owned records from the manager's own on the map.
 */
export const MAP_TEAM_RECORD_COLOR = BIZLINK_COLORS.navy;

export const MAP_MEETING_STATUS_COLORS: Record<ClientStatus, string> = {
  prospect: '#7C3AED', // purple
  in_progress: '#D97706', // orange
  new: '#2563EB', // blue
  existing: '#0E7C7B', // teal
  inactive: '#9CA3AF', // gray
};

/** Legacy meetings with no recorded client status fall back to a neutral muted dot. */
export function meetingStatusMarkerColor(status: ClientStatus | null): string {
  return status ? MAP_MEETING_STATUS_COLORS[status] : BIZLINK_COLORS.muted;
}