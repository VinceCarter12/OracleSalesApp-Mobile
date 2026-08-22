import { useMemo, useState } from 'react';
import { useOfficePins, type OfficePinClient } from './use-office-pins';
import { useMeetingMapMarkers, type MeetingMapMarker, type MeetingMapDateWindow } from './use-meeting-map-markers';
import type { MeetingMarkerType } from './policies/meeting-marker-type';
import { MAP_OFFICE_PIN_COLOR, meetingStatusMarkerColor } from './map-marker-colors';
import { firstMarkerLetter } from './map-marker-letter';
import type { ClientStatus } from '../types';
import type { LeafletMapMarker } from '../components/maps/LeafletWebViewMap';

// Batch 8 Maps extension (2026-08-04): business logic (filtering, marker
// assembly) extracted out of the route file (app/(tabs)/more/maps.tsx) so
// that file stays render-only, matching this codebase's "components render,
// hooks hold business logic" convention (_meta/engineering-principles.md).

export type PinFilterValue = 'all' | 'verified' | 'unverified';
export type MeetingTypeFilterValue = MeetingMarkerType | 'all';
export type MeetingStatusFilterValue = ClientStatus | 'all';

function buildOfficeMapMarkers(pins: OfficePinClient[]): LeafletMapMarker[] {
  return pins.map((pin) => ({
    id: `office:${pin.id}`,
    lat: pin.officeLat,
    lng: pin.officeLng,
    colorHex: MAP_OFFICE_PIN_COLOR,
    radius: 11,
    label: pin.companyName,
    icon: { kind: 'pin', text: firstMarkerLetter(pin.companyName) },
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
    colorHex: meetingStatusMarkerColor(marker.clientStatusAtMeeting),
    radius: 8,
    label: `${marker.clientName} · ${meetingLocationLabel(marker, typeLabel)}`,
    icon: { kind: 'pin', text: firstMarkerLetter(marker.clientName) },
  }));
}

/**
 * Reusable office-pin filter predicate (verified/unverified + company-name
 * search) — extracted so `lib/use-manager-maps-screen.ts` can apply the exact
 * same rules to the manager-only "My Team" pin set without duplicating this
 * logic. Generic over the row shape since `TeamOfficePin`
 * (lib/manager-team-map-service.ts) has the same `verified`/`companyName`
 * fields as `OfficePinClient` but is a structurally distinct type.
 */
export function filterOfficePins<T extends { verified: boolean; companyName: string }>(
  pins: readonly T[],
  pinFilter: PinFilterValue,
  search: string
): T[] {
  const q = search.trim().toLocaleLowerCase();
  return pins.filter(
    (pin) => (pinFilter === 'all' || (pinFilter === 'verified') === pin.verified) && (!q || pin.companyName.toLocaleLowerCase().includes(q))
  );
}

/**
 * Reusable meeting-marker filter predicate — see `filterOfficePins` doc
 * comment for why this is generic/shared.
 *
 * B-130 (Vince, 2026-08-21): the Maps search bar filtered office pins only
 * — this function never took a search term at all, so meeting markers (the
 * majority of pins on a typical map) stayed on screen regardless of what
 * was typed, making the search bar look broken. `search` defaults to `''`
 * so every existing call site (there was only ever one signature) keeps
 * compiling; callers now pass the same `officeSearch` string
 * `filterOfficePins` already receives, so both marker types are searched
 * by the one query box.
 */
export function filterMeetingMarkers<T extends { markerType: MeetingMarkerType; clientStatusAtMeeting: ClientStatus | null; clientName: string }>(
  markers: readonly T[],
  meetingTypeFilter: MeetingTypeFilterValue,
  meetingStatusFilter: MeetingStatusFilterValue,
  search = ''
): T[] {
  const q = search.trim().toLocaleLowerCase();
  return markers.filter((marker) => {
    if (meetingTypeFilter !== 'all' && marker.markerType !== meetingTypeFilter) return false;
    if (meetingStatusFilter !== 'all' && marker.clientStatusAtMeeting !== meetingStatusFilter) return false;
    return !q || marker.clientName.toLocaleLowerCase().includes(q);
  });
}

export interface MapsScreenState {
  filteredPins: OfficePinClient[];
  verifiedCount: number;
  pinFilter: PinFilterValue;
  setPinFilter: (value: PinFilterValue) => void;
  filteredMeetingMarkers: MeetingMapMarker[];
  meetingTypeFilter: MeetingTypeFilterValue;
  setMeetingTypeFilter: (value: MeetingTypeFilterValue) => void;
  meetingStatusFilter: MeetingStatusFilterValue;
  setMeetingStatusFilter: (value: MeetingStatusFilterValue) => void;
  mapMarkers: LeafletMapMarker[];
  loading: boolean;
}

/**
 * @param typeLabel `MEETING_MARKER_TYPE_LABEL` — passed in rather than imported to keep this hook's own import surface small.
 * @param dateFilter Screen-owned date filter (maps.tsx's `dateFilterEnabled`/`selectedDate`) — passed in so the
 * map markers and the meeting card list stay in sync instead of each narrowing independently.
 */
export function useMapsScreen(
  typeLabel: Record<MeetingMarkerType, string>,
  dateWindow?: MeetingMapDateWindow,
  officeSearch = ''
): MapsScreenState {
  const { pins, loading: pinsLoading } = useOfficePins();
  const { markers: meetingMarkers, loading: meetingsLoading } = useMeetingMapMarkers(dateWindow);
  const [pinFilter, setPinFilter] = useState<PinFilterValue>('all');
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<MeetingTypeFilterValue>('all');
  const [meetingStatusFilter, setMeetingStatusFilter] = useState<MeetingStatusFilterValue>('all');

  const filteredPins = filterOfficePins(pins, pinFilter, officeSearch);

  const filteredMeetingMarkers = useMemo(
    () => filterMeetingMarkers(meetingMarkers, meetingTypeFilter, meetingStatusFilter, officeSearch),
    [meetingMarkers, meetingTypeFilter, meetingStatusFilter, officeSearch]
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
    meetingStatusFilter,
    setMeetingStatusFilter,
    mapMarkers,
    loading: pinsLoading || meetingsLoading,
  };
}
