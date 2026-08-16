import { useCallback, useEffect, useState } from 'react';
import { getOrgWideProspectMarkers, type OrgWideProspectMarker } from './org-wide-prospect-markers';
import { MAP_ORG_WIDE_PROSPECT_COLOR } from './map-marker-colors';
import { firstMarkerLetter } from './map-marker-letter';
import type { LeafletMapMarker } from '../components/maps/LeafletWebViewMap';

// 2026-08-16 (Vince direction) — opt-in, all-teams "org-wide prospect" pin
// layer shared by all three Maps screens. Default OFF (a broad new
// cross-team view is the less-surprising default until Vince says
// otherwise). Online-only, same reasoning as
// `lib/po-confirmation-manager-service.ts::getManagerApprovalFeed()`: no
// local SQLite mirror exists for this, so a failed fetch while the toggle is
// ON surfaces an explicit error rather than silently showing zero pins.

export interface UseOrgWideProspectMarkers {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  markers: OrgWideProspectMarker[];
  mapMarkers: LeafletMapMarker[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

function buildMapMarkers(markers: OrgWideProspectMarker[]): LeafletMapMarker[] {
  return markers.map((marker) => ({
    id: `org-wide-prospect:${marker.id}`,
    lat: marker.lat,
    lng: marker.lng,
    colorHex: MAP_ORG_WIDE_PROSPECT_COLOR,
    radius: 8,
    label: marker.label,
    icon: { kind: 'pin', text: firstMarkerLetter(marker.label) },
  }));
}

export function useOrgWideProspectMarkers(): UseOrgWideProspectMarkers {
  const [enabled, setEnabled] = useState(false);
  const [markers, setMarkers] = useState<OrgWideProspectMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const fetchMarkers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMarkers(await getOrgWideProspectMarkers());
    } catch {
      setMarkers([]);
      setError('Could not load org-wide prospect pins. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setMarkers([]);
      setError(null);
      return;
    }
    void fetchMarkers();
  }, [enabled, retryToken, fetchMarkers]);

  return {
    enabled,
    setEnabled,
    markers,
    mapMarkers: buildMapMarkers(markers),
    loading,
    error,
    retry: () => setRetryToken((token) => token + 1),
  };
}
