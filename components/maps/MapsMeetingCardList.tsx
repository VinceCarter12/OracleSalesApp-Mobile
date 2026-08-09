import { Pressable } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { meetingLocationLabel } from '../../lib/use-maps-screen';
import { MEETING_MARKER_TYPE_LABEL } from '../../lib/policies/meeting-marker-type';
import { CLIENT_STATUS_BADGES } from '../../lib/client-status';
import { StatusBadge } from '../ui/StatusBadge';
import type { MeetingMapMarker } from '../../lib/use-meeting-map-markers';

interface MapsMeetingCardListProps {
  meetings: MeetingMapMarker[];
  startIndex: number;
  selectedMarkerIds: Set<string>;
  onCardPress: (meetingId: string) => void;
}

/** Paginated meeting-card list under the Maps inline map — split out of
 * app/(tabs)/more/maps.tsx to keep that screen file under the 300-line cap. */
export function MapsMeetingCardList({ meetings, startIndex, selectedMarkerIds, onCardPress }: MapsMeetingCardListProps) {
  return (
    <YStack gap="$2">
      {meetings.map((meeting, index) => {
        const globalIndex = startIndex + index + 1;
        const markerId = `meeting:${meeting.id}`;
        const isSelected = selectedMarkerIds.has(markerId);
        // Maps represents a completed meeting, so the lifecycle shown here is
        // the stage frozen when that meeting happened, not a later client
        // transition that would rewrite its historical context.
        const statusBadge = meeting.clientStatusAtMeeting
          ? CLIENT_STATUS_BADGES[meeting.clientStatusAtMeeting]
          : null;

        return (
          <Pressable key={meeting.id} onPress={() => onCardPress(meeting.id)}>
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
                  <XStack alignItems="center" gap="$2" flexWrap="wrap">
                    <Text flexShrink={1} fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                      {meeting.clientName}
                    </Text>
                    {statusBadge ? <StatusBadge {...statusBadge} /> : null}
                  </XStack>
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
  );
}
