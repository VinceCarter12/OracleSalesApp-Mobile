import { useCallback, useEffect, useState } from 'react';
import { useAppDb } from './app-db-provider';
import { useFocusEffect } from 'expo-router';
import { useSession } from './session-store';
import { isOfficePinVerified } from './policies/office-pin-policy';
import { subscribeSyncComplete } from './sync/sync-events';

// Batch 8 (2026-08-02): Sales/RSR Maps screen data source — Wireframe
// `a-maps`/`aRenderOfficeMaps()` (Wireframe-Sales-BizLink.html ~line 1374):
// "read-only permanent office pins" scoped to the signed-in agent's own
// clients. Local SQLite is the primary read path (ADR-001/T-003), same as
// lib/useClients.ts — a client's office pin is written locally first
// (lib/office-pin-service.ts) and this screen has no reason to wait on a
// network round-trip to show it.

export interface OfficePinClient {
  id: string;
  companyName: string;
  officeLat: number;
  officeLng: number;
  officePinUpdatedAt: string | null;
  verified: boolean;
}

interface OfficePinRow {
  id: string;
  company_name: string;
  office_lat: number;
  office_lng: number;
  office_pin_updated_at: string | null;
  office_pin_source: 'manual' | 'client_office_meeting' | null;
}

export interface UseOfficePins {
  pins: OfficePinClient[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useOfficePins(): UseOfficePins {
  const db = useAppDb();
  const { profileId } = useSession();
  const [pins, setPins] = useState<OfficePinClient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!profileId) {
      setPins([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Batch 8 Maps extension (2026-08-04): `status` is `NOT NULL DEFAULT
    // 'prospect'` on `clients` (lib/db.ts), so a plain `!= 'inactive'` is
    // sufficient — no IS NULL branch needed. Without this, a client the
    // agent already marked inactive kept showing a permanent office pin
    // here and on the map forever.
    const rows = await db.getAllAsync<OfficePinRow>(
      `SELECT id, company_name, office_lat, office_lng, office_pin_updated_at, office_pin_source
         FROM clients
        WHERE agent_id = ? AND office_lat IS NOT NULL AND office_lng IS NOT NULL AND status != 'inactive'
        ORDER BY company_name ASC`,
      [profileId]
    );
    setPins(
      rows.map((row) => ({
        id: row.id,
        companyName: row.company_name,
        officeLat: row.office_lat,
        officeLng: row.office_lng,
        officePinUpdatedAt: row.office_pin_updated_at,
        verified: isOfficePinVerified(row.office_pin_source),
      }))
    );
    setLoading(false);
  }, [db, profileId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  // B-071 precedent (lib/useClients.ts): a background syncDown() can land an
  // office pin locally well after this hook's initial fetch already ran.
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { pins, loading, refresh: fetch };
}
