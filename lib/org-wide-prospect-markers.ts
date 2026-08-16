import { supabase } from './supabase';

// 2026-08-16 (Vince direction): every role with a Maps screen (Sales/RSR,
// Manager, Executive) can opt into a company-wide layer of prospect-status
// pins across ALL teams, not just their own team/combined scope — see the
// web repo's `099_org_wide_prospect_map_markers.sql` migration for the
// SECURITY DEFINER RPC this calls. Same pattern as
// `lib/po-confirmation-manager-service.ts::getManagerApprovalFeed()`: pure
// I/O, typed row mapping, no UI. Online-only, no local SQLite mirror — an
// org-wide read isn't meaningfully cacheable without a much bigger sync-down
// redesign Vince did not ask for (mirrors `getManagerApprovalFeed()`'s same
// online-only decision).

export interface OrgWideProspectMarker {
  id: string;
  lat: number;
  lng: number;
  /** Company/client display name — same granularity the existing office pins already expose, nothing more. */
  label: string;
}

interface RemoteOrgWideProspectMarkerRow {
  id: string;
  lat: number | null;
  lng: number | null;
  label: string | null;
}

function isRenderable(row: RemoteOrgWideProspectMarkerRow): row is { id: string; lat: number; lng: number; label: string | null } {
  return row.lat !== null && row.lng !== null;
}

function toMarker(row: { id: string; lat: number; lng: number; label: string | null }): OrgWideProspectMarker {
  return { id: row.id, lat: row.lat, lng: row.lng, label: row.label ?? 'Unknown client' };
}

/**
 * `get_org_wide_prospect_map_markers()` — SECURITY DEFINER, gated server-side
 * to roles with a Maps screen and to `clients.customer_type = 'prospect'`
 * only. Throws on failure so callers can distinguish "no pins" from "fetch
 * failed" and show an explicit error rather than silently rendering nothing.
 */
export async function getOrgWideProspectMarkers(): Promise<OrgWideProspectMarker[]> {
  const { data, error } = await supabase.rpc('get_org_wide_prospect_map_markers');
  if (error) throw error;
  return ((data ?? []) as RemoteOrgWideProspectMarkerRow[]).filter(isRenderable).map(toMarker);
}
