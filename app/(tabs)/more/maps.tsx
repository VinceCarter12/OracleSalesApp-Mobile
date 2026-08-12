import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { useAuth } from '../../../lib/useAuth';
import { useSession } from '../../../lib/session-store';
import { useUserMapMarker } from '../../../lib/use-user-map-marker';
import { useMapsScreen, type MeetingTypeFilterValue, type MeetingStatusFilterValue } from '../../../lib/use-maps-screen';
import { MEETING_MARKER_TYPE_LABEL } from '../../../lib/policies/meeting-marker-type';
import { isLikelyOnline } from '../../../lib/sync/connectivity';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import type { BizFilterOption } from '../../../components/bizlink/BizFilterScroll';
import { MapLegend, OfflineBanner } from '../../../components/maps/MapsScreenSections';
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import type { DateRange } from '../../../components/bizlink/DateRangePickerModal';
import { KeyboardAwareScrollView } from '../../../components/ui/KeyboardAwareScrollView';
import { MapsFilterPanel } from '../../../components/maps/MapsFilterPanel';
import { MapsListSection } from '../../../components/maps/MapsListSection';
import { LeafletWebViewMapWithControls, type MapTileType } from '../../../components/maps/LeafletWebViewMap';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { MAPS_DATE_PRESET_OPTIONS, makeMapsPresetRange, toMapsDateWindow, type MapsDatePreset } from '../../../lib/maps-date-preset';

const MEETING_TYPE_FILTER_OPTIONS: BizFilterOption<MeetingTypeFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'client_office', label: MEETING_MARKER_TYPE_LABEL.client_office },
  { value: 'online', label: MEETING_MARKER_TYPE_LABEL.online },
  { value: 'others', label: MEETING_MARKER_TYPE_LABEL.others },
];

/** Client status at the time of the meeting (Vince 2026-08-08 direction) — 'inactive' excluded, agents never manually filter for it here. */
const MEETING_STATUS_FILTER_OPTIONS: BizFilterOption<MeetingStatusFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
];

const ITEMS_PER_PAGE = 10;

/**
 * Wireframe `a-maps` (Wireframe-Sales-BizLink.html ~line 1009) —
 * 2026-08-05 full redesign: interactive Leaflet map with office pins +
 * meeting GPS markers, search bar, map type switcher (dark/light/terrain),
 * date filter for meetings (calendar picker), filter chips relocated above
 * office pins, card tap focuses map instead of navigating. Read-only —
 * Sales/RSR scope only.
 */
export default function AgentMapsScreen() {
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
  const state = useMapsScreen(MEETING_MARKER_TYPE_LABEL, toMapsDateWindow(dateRange), searchQuery);

  const { session } = useAuth();
  const { fullName } = useSession();
  const userMarker = useUserMapMarker(session?.user.id, fullName);

  // "You here" marker merged into the office/meeting pins — shared by the
  // inline map and the expanded full-screen map so both show the same set.
  const mapMarkers = useMemo(
    () => (userMarker ? [...state.mapMarkers, userMarker] : state.mapMarkers),
    [state.mapMarkers, userMarker]
  );

  const checkOnline = useCallback(() => {
    isLikelyOnline().then(setOnline);
  }, []);
  useEffect(() => { checkOnline(); }, [checkOnline]);
  useFocusEffect(useCallback(() => { checkOnline(); }, [checkOnline]));

  // Date filtering now happens inside useMapsScreen so the map markers and this card list stay in sync.
  const displayedMeetings = state.filteredMeetingMarkers;

  // Office-only view (Vince 2026-08-10): Meeting Type = 'Client Office' swaps
  // the meeting cards for selectable office pin cards.
  const officeOnlyView = state.meetingTypeFilter === 'client_office';
  const activeListLength = officeOnlyView ? state.filteredPins.length : displayedMeetings.length;

  // Pagination logic
  const totalPages = Math.ceil(activeListLength / ITEMS_PER_PAGE);
  const paginatedOffices = state.filteredPins.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );
  const paginatedMeetings = displayedMeetings.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  function handleCardSelect(kind: 'meeting' | 'office', id: string) {
    const newSelected = new Set(selectedMarkerIds);
    const markerId = `${kind}:${id}`;

    if (newSelected.has(markerId)) {
      newSelected.delete(markerId);
    } else {
      newSelected.add(markerId);
    }

    setSelectedMarkerIds(newSelected);
  }

  function handleMeetingTypeChange(value: MeetingTypeFilterValue) {
    state.setMeetingTypeFilter(value);
    setCurrentPage(0);
  }

  function handlePresetChange(value: MapsDatePreset) {
    setDatePreset(value);
    if (value !== 'custom') setDateRange(makeMapsPresetRange(value));
    setCurrentPage(0);
  }

  function handleMarkerPress(id: string): void {
    const [kind, recordId] = id.split(':');
    if (kind === 'office') router.push(`/(tabs)/more/office-map/${recordId}`);
    if (kind === 'meeting') router.push(`/(tabs)/meetings/${recordId}`);
  }

  const filtersActive =
    datePreset !== 'last7' || state.meetingTypeFilter !== 'all' || state.meetingStatusFilter !== 'all';

  function resetFilters(): void {
    handlePresetChange('last7');
    state.setMeetingTypeFilter('all');
    state.setMeetingStatusFilter('all');
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Maps" fallbackHref="/(tabs)" />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {!online ? <OfflineBanner /> : null}

        {/* Search Bar + Filters pill */}
        <XStack gap="$2" alignItems="center" marginBottom="$3">
          <XStack flex={1} alignItems="center" gap="$2" height={52} paddingHorizontal={12} backgroundColor={BIZLINK_COLORS.card} borderRadius={16}>
            <Search size={17} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search office location..."
              placeholderTextColor={BIZLINK_COLORS.muted}
              style={{ flex: 1, color: BIZLINK_COLORS.text, fontFamily: BIZLINK_FONTS.medium, fontSize: 13 }}
            />
          </XStack>
          <Pressable
            accessibilityLabel="Toggle filters"
            onPress={() => setFilterOpen((open) => !open)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: filterOpen || filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.card,
              borderRadius: 16,
              paddingHorizontal: 14,
              height: 52,
              borderWidth: 1,
              borderColor: filterOpen || filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.line,
            }}
          >
            <SlidersHorizontal
              size={16}
              color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}
              strokeWidth={1.75}
            />
            <Text
              fontSize={11.5}
              fontFamily={BIZLINK_FONTS.medium}
              color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}
            >
              Filters
            </Text>
          </Pressable>
        </XStack>

        <BizFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
          <MapsFilterPanel
            datePreset={datePreset}
            onDatePresetChange={handlePresetChange}
            dateRange={dateRange}
            onDateRangeApply={(range) => { if (range) setDateRange(range); setCurrentPage(0); }}
            datePresetOptions={MAPS_DATE_PRESET_OPTIONS}
            meetingTypeFilter={state.meetingTypeFilter}
            onMeetingTypeChange={handleMeetingTypeChange}
            meetingTypeOptions={MEETING_TYPE_FILTER_OPTIONS}
            meetingStatusFilter={state.meetingStatusFilter}
            onMeetingStatusChange={state.setMeetingStatusFilter}
            meetingStatusOptions={MEETING_STATUS_FILTER_OPTIONS}
          />
        </BizFilterSheet>

        {/* Interactive Map with Controls */}
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
          {state.filteredPins.length} office · {displayedMeetings.length} meeting{displayedMeetings.length === 1 ? '' : 's'}
        </Text>
<MapLegend />

        {/* Meetings / Offices Section — office pin cards when Meeting Type = Client Office */}
        <MapsListSection
          officeView={officeOnlyView}
          offices={paginatedOffices}
          officeTotal={state.filteredPins.length}
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

      {/* Expanded Map Modal */}
      {mapExpanded && (
        <Modal visible transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' }}>
            <YStack flex={1} paddingTop={insets.top + 10} paddingBottom={insets.bottom + 10} paddingHorizontal={10}>
              <XStack justifyContent="flex-end" marginBottom={10}>
                <Pressable
                  onPress={() => setMapExpanded(false)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: BIZLINK_COLORS.card,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <X size={24} color={BIZLINK_COLORS.text} strokeWidth={2} />
                </Pressable>
              </XStack>
              <YStack flex={1} borderRadius={24} overflow="hidden">
                <LeafletWebViewMapWithControls
                  markers={mapMarkers}
                  selectedMarkerIds={Array.from(selectedMarkerIds)}
                  height={0}
                  tileType={mapType}
                  onTileTypeChange={setMapType}
                  expanded
                  onMarkerPress={handleMarkerPress}
                />
              </YStack>
            </YStack>
          </View>
        </Modal>
      )}

    </YStack>
  );
}
