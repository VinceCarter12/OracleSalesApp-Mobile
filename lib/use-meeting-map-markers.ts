import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useSession } from './session-store';
import { subscribeSyncComplete } from './sync/sync-events';
import { classifyMeetingMarkerType, type MeetingMarkerType } from './policies/meeting-marker-type';

// Batch 8 Maps extension (2026-08-04): Sales/RSR Maps screen's second marker
// source (meeting GPS), alongside `lib/use-office-pins.ts`'s permanent
// office pins. Local SQLite is the primary read path (ADR-001/T-003), same
// pattern as `lib/useMeetings.ts` — this hook fetches every one of the
// agent's own GPS-tagged meetings once and lets the screen filter by date
// (device-local calendar day, see `lib/local-day.ts`) and marker type
// client-side, matching `app/(tabs)/meetings/index.tsx`'s existing
// filter-in-memory pattern rather than re-querying per filter change.

export interface MeetingMapMarker {
  id: string;
  clientId: string | null;
  clientName: string;
  gpsLat: number;
  gpsLng: number;
  startCapturedAt: string;
  markerType: MeetingMarkerType;
  /** Free-text place typed on `MeetingLocationPicker`'s "Others" field (e.g. "Starbucks Alabang") — only ever set when `markerType === 'others'`; null for Client Office/Online or pre-migration rows. */
  locationName: string | null;
}

interface MeetingMapMarkerRow {
  id: string;
  client_id: string | null;
  client_name: string | null;
  gps_lat: number;
  gps_lng: number;
  start_captured_at: string;
  meeting_mode: string | null;
  location_type: string | null;
  location_name: string | null;
}

export interface UseMeetingMapMarkers {
  markers: MeetingMapMarker[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useMeetingMapMarkers(): UseMeetingMapMarkers {
  const db = useSQLiteContext();
  const { profileId } = useSession();
  const [markers, setMarkers] = useState<MeetingMapMarker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!profileId) {
      setMarkers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // `start_captured_at` is the timestamp tied to `gps_lat`/`gps_lng` (both
    // captured together at the start of the visit) — the same pair used by
    // the rest of the app (e.g. lib/cutoff-quota-service.ts) as the meeting's
    // "when" for GPS-adjacent purposes.
    const rows = await db.getAllAsync<MeetingMapMarkerRow>(
      `SELECT m.id, m.client_id, c.company_name as client_name, m.gps_lat, m.gps_lng,
              m.start_captured_at, m.meeting_mode, m.location_type, m.location_name
         FROM meetings m LEFT JOIN clients c ON c.id = m.client_id
        WHERE m.agent_id = ? AND m.gps_lat IS NOT NULL AND m.gps_lng IS NOT NULL
          AND m.start_captured_at IS NOT NULL
        ORDER BY m.start_captured_at DESC`,
      [profileId]
    );
    setMarkers(
      rows.map((row) => ({
        id: row.id,
        clientId: row.client_id,
        clientName: row.client_name ?? 'Unknown Client',
        gpsLat: row.gps_lat,
        gpsLng: row.gps_lng,
        startCapturedAt: row.start_captured_at,
        markerType: classifyMeetingMarkerType(row.meeting_mode, row.location_type),
        locationName: row.location_name,
      }))
    );
    setLoading(false);
  }, [db, profileId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  // B-071 precedent (lib/useClients.ts / lib/use-office-pins.ts): a
  // background syncDown() can land a meeting locally after this hook's
  // initial fetch already ran.
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { markers, loading, refresh: fetch };
}
