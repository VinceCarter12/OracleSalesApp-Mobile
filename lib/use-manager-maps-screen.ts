import { useMemo } from 'react';
import {
  useMapsScreen,
  filterOfficePins,
  filterMeetingMarkers,
  meetingLocationLabel,
  type MapsScreenState,
} from './use-maps-screen';
import { useManagerTeamMapData } from './use-manager-team-map-data';
import { useManagerGuestMapData } from './use-manager-guest-map-data';
import type { TeamOfficePin, TeamMember } from './manager-team-map-service';
import { useUserMapMarker } from './use-user-map-marker';
import { useManagerScope } from './manager-scope-store';
import type { ManagerScope } from './manager-scope';
import { MAP_GUEST_RECORD_COLOR, MAP_OFFICE_PIN_COLOR, MAP_TEAM_RECORD_COLOR, meetingStatusMarkerColor } from './map-marker-colors';
import { firstMarkerLetter } from './map-marker-letter';
import type { MeetingMarkerType } from './policies/meeting-marker-type';
import type { MeetingMapDateWindow, MeetingMapMarker } from './use-meeting-map-markers';
import type { OfficePinClient } from './use-office-pins';
import type { LeafletMapMarker } from '../components/maps/LeafletWebViewMap';

// Manager Maps only (Wireframe-Manager-BizLink.html `#s-maps`): layers the
// manager's own local SQLite office pins/meeting markers (unchanged Sales/RSR
// shell, `useMapsScreen`) with the live team read
// (`lib/use-manager-team-map-data.ts`, ADR-001), merged by the shared
// `useManagerScope()` store — the SAME scope Manager Home/Clients/Meetings
// already use, matching the wireframe's single `managerScope` variable.

export interface ManagerOfficePinDisplay extends OfficePinClient {
  isTeam: boolean;
  /** Guest Records scope (2026-08-22): a held client's pin — distinct from `isTeam` (a held client is never a roster member of the viewer's own team). */
  isGuest: boolean;
  /** Owning agent's profile id — only set for team/guest records; own records filter by scope, not by agent. */
  agentId: string | null;
}

export interface ManagerMeetingMarkerDisplay extends MeetingMapMarker {
  isTeam: boolean;
  isGuest: boolean;
  agentId: string | null;
}

export interface ManagerMapsScreenState {
  own: MapsScreenState;
  scope: ManagerScope;
  filteredPins: ManagerOfficePinDisplay[];
  filteredMeetingMarkers: ManagerMeetingMarkerDisplay[];
  mapMarkers: LeafletMapMarker[];
  teamAgents: TeamMember[];
  teamLoading: boolean;
  teamError: string | null;
  reloadTeam: () => Promise<void>;
  guestLoading: boolean;
  guestError: string | null;
  reloadGuest: () => Promise<void>;
}

function toDisplayPin(pin: OfficePinClient, isTeam: boolean): ManagerOfficePinDisplay {
  const { id, companyName, officeLat, officeLng, officePinUpdatedAt, verified } = pin;
  return { id, companyName, officeLat, officeLng, officePinUpdatedAt, verified, isTeam, isGuest: false, agentId: null };
}

/** B-130 (2026-08-21): `TeamOfficePin` now carries `officePinUpdatedAt` (the live team query selects and orders by it), so this passes it through instead of hardcoding null. */
function teamPinToDisplay(pin: TeamOfficePin, isGuest: boolean): ManagerOfficePinDisplay {
  const { id, companyName, officeLat, officeLng, officePinUpdatedAt, verified, agentId } = pin;
  return { id, companyName, officeLat, officeLng, officePinUpdatedAt, verified, isTeam: !isGuest, isGuest, agentId };
}

function toDisplayMeeting(marker: MeetingMapMarker, isTeam: boolean, isGuest: boolean, agentId: string | null): ManagerMeetingMarkerDisplay {
  const { id, clientId, clientName, gpsLat, gpsLng, startCapturedAt, markerType, locationName, clientStatusAtMeeting } = marker;
  return { id, clientId, clientName, gpsLat, gpsLng, startCapturedAt, markerType, locationName, clientStatusAtMeeting, isTeam, isGuest, agentId };
}

function combineByScope<T>(own: T[], team: T[], guest: T[], scope: ManagerScope): T[] {
  if (scope === 'mine') return own;
  if (scope === 'team') return team;
  if (scope === 'guest') return guest;
  return [...own, ...team, ...guest];
}

function buildPinMarkers(pins: ManagerOfficePinDisplay[]): LeafletMapMarker[] {
  return pins.map((pin) => ({
    id: `office:${pin.id}`,
    lat: pin.officeLat,
    lng: pin.officeLng,
    colorHex: pin.isGuest ? MAP_GUEST_RECORD_COLOR : pin.isTeam ? MAP_TEAM_RECORD_COLOR : MAP_OFFICE_PIN_COLOR,
    radius: 11,
    label: pin.companyName,
    icon: { kind: 'pin', text: firstMarkerLetter(pin.companyName) },
  }));
}

function buildMeetingMarkers(markers: ManagerMeetingMarkerDisplay[], typeLabel: Record<MeetingMarkerType, string>): LeafletMapMarker[] {
  return markers.map((marker) => ({
    id: `meeting:${marker.id}`,
    lat: marker.gpsLat,
    lng: marker.gpsLng,
    colorHex: marker.isGuest ? MAP_GUEST_RECORD_COLOR : marker.isTeam ? MAP_TEAM_RECORD_COLOR : meetingStatusMarkerColor(marker.clientStatusAtMeeting),
    radius: 8,
    label: `${marker.clientName} · ${meetingLocationLabel(marker, typeLabel)}`,
    icon: { kind: 'pin', text: firstMarkerLetter(marker.clientName) },
  }));
}

export function useManagerMapsScreen(
  typeLabel: Record<MeetingMarkerType, string>,
  dateWindow: MeetingMapDateWindow | undefined,
  officeSearch: string,
  /** "Teammate" picker under the "My Team" scope row (Vince, 2026-08-10) — null narrows nothing (all teammates). */
  teamAgentFilter: string | null = null,
  /** Manager's own "You here" pin — same `useUserMapMarker` initials/avatar marker as the Sales/RSR shell (`app/(tabs)/more/maps.tsx`), just never wired up here before (Vince, 2026-08-10). */
  authUid?: string,
  fullName?: string | null
): ManagerMapsScreenState {
  const { scope } = useManagerScope();
  const own = useMapsScreen(typeLabel, dateWindow, officeSearch);
  const team = useManagerTeamMapData(dateWindow);
  const guest = useManagerGuestMapData(dateWindow);
  const userMarker = useUserMapMarker(authUid, fullName ?? null);

  const teamPins = useMemo(() => {
    const filtered = filterOfficePins(team.teamMapData.officePins, own.pinFilter, officeSearch);
    return teamAgentFilter ? filtered.filter((pin) => pin.agentId === teamAgentFilter) : filtered;
  }, [team.teamMapData.officePins, own.pinFilter, officeSearch, teamAgentFilter]);
  const teamMeetings = useMemo(() => {
    const filtered = filterMeetingMarkers(team.teamMapData.meetingMarkers, own.meetingTypeFilter, own.meetingStatusFilter, officeSearch);
    return teamAgentFilter ? filtered.filter((marker) => marker.agentId === teamAgentFilter) : filtered;
  }, [team.teamMapData.meetingMarkers, own.meetingTypeFilter, own.meetingStatusFilter, officeSearch, teamAgentFilter]);
  // Guest Records (2026-08-22): held-client pins/markers — no teammate
  // filter (a held client was never a roster member), same search/type/
  // status filters as team pins/meetings.
  const guestPins = useMemo(
    () => filterOfficePins(guest.guestMapData.officePins, own.pinFilter, officeSearch),
    [guest.guestMapData.officePins, own.pinFilter, officeSearch]
  );
  const guestMeetings = useMemo(
    () => filterMeetingMarkers(guest.guestMapData.meetingMarkers, own.meetingTypeFilter, own.meetingStatusFilter, officeSearch),
    [guest.guestMapData.meetingMarkers, own.meetingTypeFilter, own.meetingStatusFilter, officeSearch]
  );

  // B-130 (Vince, 2026-08-21): `combineByScope` just concatenates own-then-
  // team-then-guest, which is fine for 'mine'/'team'/'guest' (only one
  // source is ever non-empty) but under 'combined' put every own
  // pin/meeting ahead of every team/guest one regardless of actual recency —
  // each side was internally newest-first, but the merge itself wasn't.
  // Re-sorting after combining makes "combined" genuinely interleaved by
  // recency, not own-then-team-then-guest.
  const filteredPins = useMemo(() => {
    const ownDisplay = own.filteredPins.map((pin) => toDisplayPin(pin, false));
    const teamDisplay = teamPins.map((pin) => teamPinToDisplay(pin, false));
    const guestDisplay = guestPins.map((pin) => teamPinToDisplay(pin, true));
    const combined = combineByScope(ownDisplay, teamDisplay, guestDisplay, scope);
    return [...combined].sort((a, b) => (b.officePinUpdatedAt ?? '').localeCompare(a.officePinUpdatedAt ?? ''));
  }, [own.filteredPins, teamPins, guestPins, scope]);

  const filteredMeetingMarkers = useMemo(() => {
    const ownDisplay = own.filteredMeetingMarkers.map((marker) => toDisplayMeeting(marker, false, false, null));
    const teamDisplay = teamMeetings.map((marker) => toDisplayMeeting(marker, true, false, marker.agentId));
    const guestDisplay = guestMeetings.map((marker) => toDisplayMeeting(marker, false, true, marker.agentId));
    const combined = combineByScope(ownDisplay, teamDisplay, guestDisplay, scope);
    return [...combined].sort((a, b) => b.startCapturedAt.localeCompare(a.startCapturedAt));
  }, [own.filteredMeetingMarkers, teamMeetings, guestMeetings, scope]);

  const mapMarkers = useMemo(() => {
    const pinAndMeetingMarkers = [...buildPinMarkers(filteredPins), ...buildMeetingMarkers(filteredMeetingMarkers, typeLabel)];
    return userMarker ? [...pinAndMeetingMarkers, userMarker] : pinAndMeetingMarkers;
  }, [filteredPins, filteredMeetingMarkers, typeLabel, userMarker]);

  return {
    own,
    scope,
    filteredPins,
    filteredMeetingMarkers,
    mapMarkers,
    teamAgents: team.teamMapData.teamAgents,
    teamLoading: team.loading,
    teamError: team.error,
    reloadTeam: team.reload,
    guestLoading: guest.loading,
    guestError: guest.error,
    reloadGuest: guest.reload,
  };
}
