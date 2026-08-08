import { useMemo, useState } from 'react';
import { useOfficePins, type OfficePinClient } from './use-office-pins';
import { useMeetingMapMarkers, type MeetingMapMarker } from './use-meeting-map-markers';
import { isSameCalendarDay } from './local-day';
import type { MeetingMarkerType } from './policies/meeting-marker-type';
import { BIZLINK_COLORS } from './theme';
import type { LeafletMapMarker } from '../components/maps/LeafletWebViewMap';

// Batch 8 Maps extension (2026-08-04): business logic (filtering, marker
// assembly) extracted out of the route file (app/(tabs)/more/maps.tsx) so
// that file stays render-only, matching this codebase's "components render,
// hooks hold business logic" convention (_meta/engineering-principles.md).

export type PinFilterValue = 'all' | 'verified' | 'unverified';
export type MeetingTypeFilterValue = MeetingMarkerType | 'all';

function buildOfficeMapMarkers(pins: OfficePinClient[]): LeafletMapMarker[] {
  return pins.map((pin) => ({
    id: `office:${pin.id}`,
    lat: pin.officeLat,
    lng: pin.officeLng,
    colorHex: pin.verified ? BIZLINK_COLORS.brand : BIZLINK_COLORS.orange,
    radius: 11,
    label: pin.companyName,
  }));
}

/** "Client Office"/"Online" are fixed categories (the label IS the place), but "Others" is a free-text spot the agent typed (e.g. "Starbucks Alabang") — show that instead of the generic bucket name whenever it was actually captured. */
export function meetingLocationLabel(marker: MeetingMapMarker, typeLabel: Record<MeetingMarkerType, string>): string {
  if (marker.markerType === 'others' && marker.locationName) return marker.locationName;
  return typeLabel[marker.markerType];
}

function buildMeetingMapMarkers(markers: MeetingMapMarker[], typeLabel: Record<MeetingMarkerType, string>): LeafletMapMarker[] {
  return markers.map((marker) => ({
    id: `meeting:${marker.id}`,
    lat: marker.gpsLat,
    lng: marker.gpsLng,
    colorHex: BIZLINK_COLORS.navy,
    radius: 8,
    label: `${marker.clientName} · ${meetingLocationLabel(marker, typeLabel)}`,
  }));
}

export interface MapsScreenState {
  filteredPins: OfficePinClient[];
  verifiedCount: number;
  pinFilter: PinFilterValue;
  setPinFilter: (value: PinFilterValue) => void;
  filteredMeetingMarkers: MeetingMapMarker[];
  meetingTypeFilter: MeetingTypeFilterValue;
  setMeetingTypeFilter: (value: MeetingTypeFilterValue) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  mapMarkers: LeafletMapMarker[];
  loading: boolean;
}

/** @param typeLabel `MEETING_MARKER_TYPE_LABEL` — passed in rather than imported to keep this hook's own import surface small. */
export function useMapsScreen(typeLabel: Record<MeetingMarkerType, string>): MapsScreenState {
  const { pins, loading: pinsLoading } = useOfficePins();
  const { markers: meetingMarkers, loading: meetingsLoading } = useMeetingMapMarkers();
  const [pinFilter, setPinFilter] = useState<PinFilterValue>('all');
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<MeetingTypeFilterValue>('all');
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const filteredPins = pins.filter((pin) => pinFilter === 'all' || (pinFilter === 'verified') === pin.verified);

  const filteredMeetingMarkers = useMemo(
    () =>
      meetingMarkers.filter((marker) => {
        if (!isSameCalendarDay(marker.startCapturedAt, selectedDate.toISOString())) return false;
        return meetingTypeFilter === 'all' || marker.markerType === meetingTypeFilter;
      }),
    [meetingMarkers, selectedDate, meetingTypeFilter]
  );

  const mapMarkers = useMemo<LeafletMapMarker[]>(
    () => [...buildOfficeMapMarkers(filteredPins), ...buildMeetingMapMarkers(filteredMeetingMarkers, typeLabel)],
    [filteredPins, filteredMeetingMarkers, typeLabel]
  );

  return {
    filteredPins,
    verifiedCount: pins.filter((pin) => pin.verified).length,
    pinFilter,
    setPinFilter,
    filteredMeetingMarkers,
    meetingTypeFilter,
    setMeetingTypeFilter,
    selectedDate,
    setSelectedDate,
    mapMarkers,
    loading: pinsLoading || meetingsLoading,
  };
}
