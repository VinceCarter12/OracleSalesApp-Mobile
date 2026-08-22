import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useAuth } from '../../../lib/useAuth';
import { useSession } from '../../../lib/session-store';
import { useManagerMapsScreen } from '../../../lib/use-manager-maps-screen';
import { useOrgWideProspectMarkers } from '../../../lib/use-org-wide-prospect-markers';
import { MEETING_MARKER_TYPE_LABEL } from '../../../lib/policies/meeting-marker-type';
import type { MeetingTypeFilterValue, MeetingStatusFilterValue } from '../../../lib/use-maps-screen';
import { MAP_GUEST_RECORD_COLOR, MAP_TEAM_RECORD_COLOR } from '../../../lib/map-marker-colors';
import { isLikelyOnline } from '../../../lib/sync/connectivity';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { useManagerScope } from '../../../lib/manager-scope-store';
import { DEFAULT_MANAGER_SCOPE, type ManagerScope } from '../../../lib/manager-scope';
import type { BizFilterOption } from '../../../components/bizlink/BizFilterScroll';
import { MapLegend, OfflineBanner, OrgWideProspectErrorBanner, ORG_WIDE_PROSPECT_LEGEND_ENTRY } from '../../../components/maps/MapsScreenSections';
import { OrgWideProspectFilterRow } from '../../../components/maps/OrgWideProspectFilterRow';
import { ManagerTeamMapStatusBanner } from '../../../components/maps/ManagerTeamMapStatusBanner';
import { ManagerMapScopeFilterRow } from '../../../components/maps/ManagerMapScopeFilterRow';
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import type { DateRange } from '../../../components/bizlink/DateRangePickerModal';
import { KeyboardAwareScrollView } from '../../../components/ui/KeyboardAwareScrollView';
import { MapsFilterPanel } from '../../../components/maps/MapsFilterPanel';
import { MapsSearchFilterBar } from '../../../components/maps/MapsSearchFilterBar';
import { MapsListSection } from '../../../components/maps/MapsListSection';
import { LeafletWebViewMapWithControls, type MapTileType } from '../../../components/maps/LeafletWebViewMap';
import { MapExpandedModal } from '../../../components/maps/MapExpandedModal';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { MAPS_DATE_PRESET_OPTIONS, makeMapsPresetRange, toMapsDateWindow, type MapsDatePreset } from '../../../lib/maps-date-preset';

// Manager-only extension of Wireframe-Sales-BizLink.html `a-maps` — see
// Wireframe-Manager-BizLink.html `#s-maps` (line ~798) for the additional
// "My Records"/"My Team"/"Combined" scope chips and the "Team record" legend
// entry. Everything else (interactive map, office pins, meeting GPS markers,
// map-type switcher, expanded modal, date filter, search, pager) is the
// unchanged Sales/RSR shell from app/(tabs)/more/maps.tsx.

const MEETING_TYPE_FILTER_OPTIONS: BizFilterOption<MeetingTypeFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'client_office', label: MEETING_MARKER_TYPE_LABEL.client_office },
  { value: 'online', label: MEETING_MARKER_TYPE_LABEL.online },
  { value: 'others', label: MEETING_MARKER_TYPE_LABEL.others },
];

const MEETING_STATUS_FILTER_OPTIONS: BizFilterOption<MeetingStatusFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
];

const ITEMS_PER_PAGE = 10;

export default function ManagerMapsScreen() {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapType, setMapType] = useState<MapTileType>('light');
  const [selectedMarkerIds, setSelectedMarkerIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [datePreset, setDatePreset] = useState<MapsDatePreset>('last7');
  const [dateRange, setDateRange] = useState<DateRange>(() => makeMapsPresetRange('last7'));
  const [filterOpen, setFilterOpen] = useState(false);
  const [teamAgentFilter, setTeamAgentFilter] = useState<string | null>(null);
  const { scope, setScope } = useManagerScope();
  const { session } = useAuth();
  const { fullName } = useSession();
  const managerMaps = useManagerMapsScreen(
    MEETING_MARKER_TYPE_LABEL,
    toMapsDateWindow(dateRange),
    searchQuery,
    teamAgentFilter,
    session?.user.id,
    fullName
  );
  const { own } = managerMaps;
  const orgWideProspects = useOrgWideProspectMarkers();
  const mapMarkers = [...managerMaps.mapMarkers, ...orgWideProspects.mapMarkers];

  const checkOnline = useCallback(() => {
    isLikelyOnline().then(setOnline);
  }, []);
  useEffect(() => { checkOnline(); }, [checkOnline]);
  useFocusEffect(useCallback(() => { checkOnline(); }, [checkOnline]));

  // Scope change re-filters everything (pins/meetings sourced fresh from
  // managerMaps) and must reset the pager to page 1, per the task spec.
  const [lastScope, setLastScope] = useState(scope);
  if (scope !== lastScope) {
    setLastScope(scope);
    setCurrentPage(0);
  }

  const displayedMeetings = managerMaps.filteredMeetingMarkers;
  const officeOnlyView = own.meetingTypeFilter === 'client_office';
  const activeListLength = officeOnlyView ? managerMaps.filteredPins.length : displayedMeetings.length;

  const totalPages = Math.ceil(activeListLength / ITEMS_PER_PAGE);
  const paginatedOffices = managerMaps.filteredPins.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  const paginatedMeetings = displayedMeetings.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  function handleCardSelect(kind: 'meeting' | 'office', id: string) {
    const newSelected = new Set(selectedMarkerIds);
    const markerId = `${kind}:${id}`;
    if (newSelected.has(markerId)) newSelected.delete(markerId);
    else newSelected.add(markerId);
    setSelectedMarkerIds(newSelected);
  }

  function handleMeetingTypeChange(value: MeetingTypeFilterValue) {
    own.setMeetingTypeFilter(value);
    setCurrentPage(0);
  }

  function handlePresetChange(value: MapsDatePreset) {
    setDatePreset(value);
    if (value !== 'custom') setDateRange(makeMapsPresetRange(value));
    setCurrentPage(0);
  }

  function handleScopeChange(value: ManagerScope) {
    setScope(value);
    setTeamAgentFilter(null);
    setCurrentPage(0);
  }

  function handleTeamAgentFilterChange(agentId: string | null) {
    setTeamAgentFilter(agentId);
    setCurrentPage(0);
  }

  // Team pins live only in the live team read, never in this manager's own
  // SQLite mirror (ADR-001) — the shared office-map detail screen falls back
  // to query params for exactly this "not my own pin" case (same pattern as
  // Manager Lost Opportunities' office-pin link).
  function handleMarkerPress(id: string): void {
    const [kind, recordId] = id.split(':');
    if (kind === 'office') {
      const pin = managerMaps.filteredPins.find((p) => p.id === recordId);
      // Guest Records pins are also "not my own pin" — same query-param
      // routing as a team pin (neither lives in this manager's own SQLite).
      if (pin?.isTeam || pin?.isGuest) {
        router.push({
          pathname: '/(manager)/more/office-map/[id]',
          params: {
            id: pin.id,
            companyName: pin.companyName,
            lat: String(pin.officeLat),
            lng: String(pin.officeLng),
            verified: pin.verified ? '1' : '0',
            fallback: '/(manager)/more/maps',
          },
        });
      } else {
        router.push(`/(manager)/more/office-map/${recordId}`);
      }
    }
    if (kind === 'meeting') router.push(`/(manager)/more/meetings/${recordId}`);
  }

  const filtersActive =
    datePreset !== 'last7' ||
    own.meetingTypeFilter !== 'all' ||
    own.meetingStatusFilter !== 'all' ||
    scope !== DEFAULT_MANAGER_SCOPE ||
    teamAgentFilter !== null ||
    orgWideProspects.enabled;

  function resetFilters(): void {
    handlePresetChange('last7');
    own.setMeetingTypeFilter('all');
    own.setMeetingStatusFilter('all');
    handleScopeChange(DEFAULT_MANAGER_SCOPE);
    orgWideProspects.setEnabled(false);
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Office Map" fallbackHref="/(manager)" />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {!online ? <OfflineBanner /> : null}

        <MapsSearchFilterBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((open) => !open)}
          filtersActive={filtersActive}
        />

        <BizFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
          <ManagerMapScopeFilterRow
            scope={scope}
            onScopeChange={handleScopeChange}
            teamAgents={managerMaps.teamAgents}
            teamAgentFilter={teamAgentFilter}
            onTeamAgentFilterChange={handleTeamAgentFilterChange}
          />
          <MapsFilterPanel
            datePreset={datePreset}
            onDatePresetChange={handlePresetChange}
            dateRange={dateRange}
            onDateRangeApply={(range) => { if (range) setDateRange(range); setCurrentPage(0); }}
            datePresetOptions={MAPS_DATE_PRESET_OPTIONS}
            meetingTypeFilter={own.meetingTypeFilter}
            onMeetingTypeChange={handleMeetingTypeChange}
            meetingTypeOptions={MEETING_TYPE_FILTER_OPTIONS}
            meetingStatusFilter={own.meetingStatusFilter}
            onMeetingStatusChange={own.setMeetingStatusFilter}
            meetingStatusOptions={MEETING_STATUS_FILTER_OPTIONS}
          />
          <OrgWideProspectFilterRow enabled={orgWideProspects.enabled} onChange={orgWideProspects.setEnabled} />
        </BizFilterSheet>

        {orgWideProspects.enabled && orgWideProspects.error ? (
          <OrgWideProspectErrorBanner message={orgWideProspects.error} onRetry={orgWideProspects.retry} />
        ) : null}

        <LeafletWebViewMapWithControls
          markers={mapMarkers}
          selectedMarkerIds={Array.from(selectedMarkerIds)}
          height={300}
          tileType={mapType}
          onTileTypeChange={setMapType}
          onExpandPress={() => setMapExpanded(true)}
          onMarkerPress={handleMarkerPress}
        />

        <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand} marginTop="$2">
          {managerMaps.filteredPins.length} office · {displayedMeetings.length} meeting{displayedMeetings.length === 1 ? '' : 's'}
        </Text>
        <MapLegend
          extraItems={[
            ...(scope === 'team' || scope === 'combined' ? [{ color: MAP_TEAM_RECORD_COLOR, label: 'Team record' }] : []),
            ...(scope === 'guest' || scope === 'combined' ? [{ color: MAP_GUEST_RECORD_COLOR, label: 'Guest record' }] : []),
            ...(orgWideProspects.enabled ? [ORG_WIDE_PROSPECT_LEGEND_ENTRY] : []),
          ]}
        />

        <ManagerTeamMapStatusBanner
          scope={scope}
          loading={managerMaps.teamLoading || managerMaps.guestLoading}
          error={managerMaps.teamError ?? managerMaps.guestError}
          onRetry={() => {
            managerMaps.reloadTeam();
            managerMaps.reloadGuest();
          }}
        />

        <MapsListSection
          officeView={officeOnlyView}
          offices={paginatedOffices}
          officeTotal={managerMaps.filteredPins.length}
          meetings={paginatedMeetings}
          meetingTotal={displayedMeetings.length}
          startIndex={currentPage * ITEMS_PER_PAGE}
          selectedMarkerIds={selectedMarkerIds}
          onMeetingPress={(id) => handleCardSelect('meeting', id)}
          onOfficePress={(id) => handleCardSelect('office', id)}
        />
      </KeyboardAwareScrollView>

      {totalPages > 0 && (
        <BizFloatingPager
          page={currentPage + 1}
          totalPages={totalPages}
          onPageChange={(p) => setCurrentPage(p - 1)}
          bottomOffset={insets.bottom + 16}
        />
      )}

      {mapExpanded && (
        <MapExpandedModal
          markers={mapMarkers}
          selectedMarkerIds={Array.from(selectedMarkerIds)}
          tileType={mapType}
          onTileTypeChange={setMapType}
          onMarkerPress={handleMarkerPress}
          onClose={() => setMapExpanded(false)}
        />
      )}
    </YStack>
  );
}
