import { supabase } from './supabase';

// Client field-locations read (§visibility, web migration 126, 2026-08-22): the
// sales/RSR client-detail screen needs to SEE the on-the-ground relocation pins
// (and additional-branch flags) that collection/delivery officers set in the
// field — the corrected municipality, who set it, when — alongside the store's
// registered clients.city. Field roles own the write + the local mirror; a sales
// agent never syncs client_locations locally (113 RLS is field-only), so this is
// a direct ONLINE read through the `get_client_locations` SECURITY DEFINER RPC —
// the only read path granted to non-field roles. See STORE_LOCATIONS_CONTRACT.md
// §visibility+autoderive.
//
// area/province are the web-DERIVED canonical PSGC locality (migration 126 reverse-
// geocodes the pin a few seconds after it syncs) or the officer's typed fallback
// until then — either way it's shown ALONGSIDE the registered city, never as a
// replacement (the registered value stays authoritative for territory/assignment
// until an admin promotes a field value — owner decision 2026-08-22).

export interface ClientFieldLocation {
  id: string;
  /** 1-based "Location N" as ordered server-side. */
  seq: number;
  label: string | null;
  lat: number;
  lng: number;
  isCurrent: boolean;
  /**
   * 'relocation' — the SAME store moved here (becomes the current pin).
   * 'additional_branch' — a SEPARATE second store at this client, flagged for
   * admin triage; never the current pin, never drives the registered area.
   */
  kind: 'relocation' | 'additional_branch';
  /** Field-observed / pin-derived municipality (canonical PSGC name), or null. */
  area: string | null;
  province: string | null;
  /** The field officer who set the pin — the "set by X" trust signal. */
  setByName: string | null;
  capturedAt: string;
}

interface GetClientLocationsRow {
  id: string;
  seq: number;
  label: string | null;
  lat: number;
  lng: number;
  is_current: boolean;
  kind: string;
  area: string | null;
  province: string | null;
  set_by_name: string | null;
  captured_at: string;
}

/**
 * PostgREST reports a not-yet-deployed RPC as PGRST202 ("function not found").
 * Until migration 126 reaches an env, treat that as "no field locations" (empty)
 * rather than a hard error — the card simply hides, so this merges safely before
 * or after web (same pattern as use-remit-receivers.ts).
 */
function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === 'PGRST202' || /get_client_locations/.test(error.message ?? ''));
}

function rowToLocation(r: GetClientLocationsRow): ClientFieldLocation {
  return {
    id: r.id,
    seq: r.seq,
    label: r.label,
    lat: r.lat,
    lng: r.lng,
    isCurrent: r.is_current,
    kind: r.kind === 'additional_branch' ? 'additional_branch' : 'relocation',
    area: r.area,
    province: r.province,
    setByName: r.set_by_name,
    capturedAt: r.captured_at,
  };
}

/**
 * All field-set locations for a client, ordered seq ASC (as the RPC returns).
 * Empty when the client has none, when offline, or when the RPC isn't deployed.
 */
export async function fetchClientFieldLocations(clientId: string): Promise<ClientFieldLocation[]> {
  const { data, error } = await supabase.rpc('get_client_locations', { p_client_id: clientId });
  if (error) {
    if (isMissingRpc(error)) return []; // RPC not deployed yet → hide the card.
    throw error;
  }
  return ((data ?? []) as GetClientLocationsRow[]).map(rowToLocation);
}
