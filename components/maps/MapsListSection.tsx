import { Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { MapsMeetingCardList } from './MapsMeetingCardList';
import { MapsOfficePinCardList } from './MapsOfficePinCardList';
import type { MeetingMapMarker } from '../../lib/use-meeting-map-markers';
import type { OfficePinClient } from '../../lib/use-office-pins';

interface MapsListSectionProps {
  /** Office-only view — when the Meeting Type filter is 'Client Office', office
   * pin cards replace the meeting cards so agents can select an office pin. */
  officeView: boolean;
  offices: OfficePinClient[];
  officeTotal: number;
  meetings: MeetingMapMarker[];
  meetingTotal: number;
  startIndex: number;
  selectedMarkerIds: Set<string>;
  onMeetingPress: (meetingId: string) => void;
  onOfficePress: (pinId: string) => void;
}

/** The list section under the Maps inline map — switches between the paginated
 * meetings cards (default) and the paginated office pin cards (Meeting Type =
 * Client Office), so app/(tabs)/more/maps.tsx renders one call instead of two
 * near-twins. */
export function MapsListSection({
  officeView,
  offices,
  officeTotal,
  meetings,
  meetingTotal,
  startIndex,
  selectedMarkerIds,
  onMeetingPress,
  onOfficePress,
}: MapsListSectionProps) {
  const title = officeView ? 'Offices' : 'Meetings';
  const count = officeView ? officeTotal : meetingTotal;
  const label = `${count} ${officeView ? 'office' : 'meeting'}${count === 1 ? '' : 's'}`;
  return (
    <YStack>
      <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginTop="$4" marginBottom="$2">
        {title}
      </Text>
      <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand} marginBottom="$3">
        {label}
      </Text>
      {officeView ? (
        <MapsOfficePinCardList
          pins={offices}
          startIndex={startIndex}
          selectedMarkerIds={selectedMarkerIds}
          onCardPress={onOfficePress}
        />
      ) : (
        <MapsMeetingCardList
          meetings={meetings}
          startIndex={startIndex}
          selectedMarkerIds={selectedMarkerIds}
          onCardPress={onMeetingPress}
        />
      )}
    </YStack>
  );
}