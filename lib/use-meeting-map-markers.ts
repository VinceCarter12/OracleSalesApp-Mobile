import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useSession } from './session-store';
import { subscribeSyncComplete } from './sync/sync-events';
import { classifyMeetingMarkerType, type MeetingMarkerType } from './policies/meeting-marker-type';
import type { ClientStatus } from '../types';

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
  /** Client's lifecycle status AT THE TIME of this meeting (B-095 pattern, see lib/client-status.ts#getMeetingLifecycleStatus) — null for legacy pre-migration rows or client-less meetings. Drives the map pin color. */
  clientStatusAtMeeting: ClientStatus | null;
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
  client_status_at_meeting: ClientStatus | null;
}

export interface UseMeetingMapMarkers {
  markers: MeetingMapMarker[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export interface MeetingMapDateWindow {
  startAt?: string;
  endAtExclusive?: string;
}

export function useMeetingMapMarkers(dateWindow?: MeetingMapDateWindow): UseMeetingMapMarkers {
  const db = useSQLiteContext();
  const { profileId } = useSession();
  const startAt = dateWindow?.startAt;
  const endAtExclusive = dateWindow?.endAtExclusive;
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
    const clauses = [
      'm.agent_id = ?',
      'm.gps_lat IS NOT NULL',
      'm.gps_lng IS NOT NULL',
      'm.start_captured_at IS NOT NULL',
      ...(startAt ? ['m.start_captured_at >= ?'] : []),
      ...(endAtExclusive ? ['m.start_captured_at < ?'] : []),
    ];
    const args: string[] = [profileId];
    if (startAt) args.push(startAt);
    if (endAtExclusive) args.push(endAtExclusive);
    const rows = await db.getAllAsync<MeetingMapMarkerRow>(
      // Explicit column list (no `m.*`), so coalescing straight into
      // `client_name` is unambiguous here — unlike useMeetings. This query
      // never had the client-exists guard: it already showed meetings for
      // removed clients, just as "Unknown Client". Now they keep their name.
      `SELECT m.id, m.client_id, COALESCE(c.company_name, m.client_name) as client_name,
              m.gps_lat, m.gps_lng,
              m.start_captured_at, m.meeting_mode, m.location_type, m.location_name,
              m.client_status_at_meeting
         FROM meetings m LEFT JOIN clients c ON c.id = m.client_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY m.start_captured_at DESC`,
      args
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
        clientStatusAtMeeting: row.client_status_at_meeting ?? null,
      }))
    );
    setLoading(false);
  }, [db, profileId, startAt, endAtExclusive]);

  useEffect(() => {
    // SQLite fetch synchronizes local state when the query window changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch();
  }, [fetch]);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  // B-071 precedent (lib/useClients.ts / lib/use-office-pins.ts): a
  // background syncDown() can land a meeting locally after this hook's
  // initial fetch already ran.
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { markers, loading, refresh: fetch };
}
