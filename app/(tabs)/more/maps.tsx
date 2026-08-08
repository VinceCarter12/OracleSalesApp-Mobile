import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Calendar, Search, X } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useMapsScreen, meetingLocationLabel, type MeetingTypeFilterValue } from '../../../lib/use-maps-screen';
import { MEETING_MARKER_TYPE_LABEL } from '../../../lib/policies/meeting-marker-type';
import { isLikelyOnline } from '../../../lib/sync/connectivity';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import type { BizFilterOption } from '../../../components/bizlink/BizFilterScroll';
import {
  MapLegend,
  OfflineBanner,
} from '../../../components/maps/MapsScreenSections';
import { DatePickerModal } from '../../../components/maps/DatePickerModal';
import { LeafletWebViewMapWithControls, type MapTileType } from '../../../components/maps/LeafletWebViewMap';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';

const MEETING_TYPE_FILTER_OPTIONS: BizFilterOption<MeetingTypeFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'client_office', label: MEETING_MARKER_TYPE_LABEL.client_office },
  { value: 'online', label: MEETING_MARKER_TYPE_LABEL.online },
  { value: 'others', label: MEETING_MARKER_TYPE_LABEL.others },
];

const ITEMS_PER_PAGE = 4;

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
  const state = useMapsScreen(MEETING_MARKER_TYPE_LABEL);
  const [online, setOnline] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapType, setMapType] = useState<MapTileType>('dark');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedMarkerIds, setSelectedMarkerIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const checkOnline = useCallback(() => {
    isLikelyOnline().then(setOnline);
  }, []);
  useEffect(() => { checkOnline(); }, [checkOnline]);
  useFocusEffect(useCallback(() => { checkOnline(); }, [checkOnline]));

  // Filter meetings by date only if date filter is enabled
  const displayedMeetings = dateFilterEnabled 
    ? state.filteredMeetingMarkers.filter(meeting => 
        new Date(meeting.startCapturedAt).toDateString() === selectedDate.toDateString()
      )
    : state.filteredMeetingMarkers;

  // Pagination logic
  const totalPages = Math.ceil(displayedMeetings.length / ITEMS_PER_PAGE);
  const paginatedMeetings = displayedMeetings.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  function handleCardPress(meetingId: string) {
    const newSelected = new Set(selectedMarkerIds);
    const markerId = `meeting:${meetingId}`;
    
    if (newSelected.has(markerId)) {
      newSelected.delete(markerId);
    } else {
      newSelected.add(markerId);
    }
    
    setSelectedMarkerIds(newSelected);
  }

  function handleDateSelect(date: Date) {
    setSelectedDate(date);
    setDateFilterEnabled(true);
    setCurrentPage(0);
    setDatePickerVisible(false);
  }

  function handleClearDateFilter() {
    setDateFilterEnabled(false);
    setCurrentPage(0);
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Maps" fallbackHref="/(tabs)" />
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {!online ? <OfflineBanner /> : null}

        {/* Search Bar with Date Picker */}
        <XStack gap="$2" marginBottom="$3">
          <XStack flex={1} alignItems="center" gap="$2" height={44} paddingHorizontal={12} backgroundColor={BIZLINK_COLORS.card} borderRadius={16}>
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
            onPress={() => setDatePickerVisible(true)}
            style={{
              height: 44,
              paddingHorizontal: 12,
              backgroundColor: dateFilterEnabled ? BIZLINK_COLORS.brand : BIZLINK_COLORS.card,
              borderRadius: 16,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Calendar size={20} color={dateFilterEnabled ? '#FFFFFF' : BIZLINK_COLORS.brand} strokeWidth={1.75} />
          </Pressable>
          {dateFilterEnabled && (
            <Pressable
              onPress={handleClearDateFilter}
              style={{
                height: 44,
                paddingHorizontal: 12,
                backgroundColor: BIZLINK_COLORS.card,
                borderRadius: 16,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <X size={20} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            </Pressable>
          )}
        </XStack>

        {/* Interactive Map with Controls */}
        <LeafletWebViewMapWithControls
          markers={state.mapMarkers}
          selectedMarkerIds={Array.from(selectedMarkerIds)}
          height={300}
          tileType={mapType}
          onTileTypeChange={setMapType}
          onExpandPress={() => setMapExpanded(true)}
        />

        <MapLegend />

        {/* Meetings Section */}
        <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginTop="$4" marginBottom="$2">
          Meetings
        </Text>

        {/* Meeting Type Filters - Scrollable */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <XStack gap="$2">
            {MEETING_TYPE_FILTER_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => state.setMeetingTypeFilter(option.value)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor:
                    state.meetingTypeFilter === option.value
                      ? BIZLINK_COLORS.brand
                      : BIZLINK_COLORS.card,
                }}
              >
                <Text
                  fontSize={13}
                  fontFamily={BIZLINK_FONTS.semibold}
                  color={
                    state.meetingTypeFilter === option.value
                      ? '#FFFFFF'
                      : BIZLINK_COLORS.text
                  }
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </XStack>
        </ScrollView>

        <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand} marginBottom="$3">
          {displayedMeetings.length} meeting{displayedMeetings.length === 1 ? '' : 's'}
          {dateFilterEnabled && ` as ${selectedDate.toLocaleDateString()}`}
        </Text>

        {/* Meeting Cards with Pagination */}
        <YStack gap="$2">
          {paginatedMeetings.map((meeting, index) => {
            const globalIndex = currentPage * ITEMS_PER_PAGE + index + 1;
            const markerId = `meeting:${meeting.id}`;
            const isSelected = selectedMarkerIds.has(markerId);
            
            return (
              <Pressable
                key={meeting.id}
                onPress={() => handleCardPress(meeting.id)}
              >
                <View
                  backgroundColor={isSelected ? BIZLINK_COLORS.soft : BIZLINK_COLORS.card}
                  borderRadius={20}
                  padding={14}
                  borderWidth={isSelected ? 2 : 0}
                  borderColor={BIZLINK_COLORS.brand}
                >
                  <XStack gap="$3" alignItems="center">
                    <View
                      width={36}
                      height={36}
                      borderRadius={18}
                      backgroundColor={BIZLINK_COLORS.brand}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize={16} fontFamily={BIZLINK_FONTS.semibold} color="#FFFFFF">
                        {globalIndex}
                      </Text>
                    </View>
                    <YStack flex={1} gap="$1">
                      <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                        {meeting.clientName}
                      </Text>
                      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                        {meetingLocationLabel(meeting, MEETING_MARKER_TYPE_LABEL)}
                      </Text>
                    </YStack>
                  </XStack>
                </View>
              </Pressable>
            );
          })}
        </YStack>

      </ScrollView>

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
                  markers={state.mapMarkers}
                  selectedMarkerIds={Array.from(selectedMarkerIds)}
                  height={0}
                  tileType={mapType}
                  onTileTypeChange={setMapType}
                  expanded
                />
              </YStack>
            </YStack>
          </View>
        </Modal>
      )}

      <DatePickerModal
        visible={datePickerVisible}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
        onClose={() => setDatePickerVisible(false)}
      />
    </YStack>
  );
}
