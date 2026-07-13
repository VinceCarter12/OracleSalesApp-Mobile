import { Text, View, XStack, YStack } from 'tamagui';
import { ChevronRight } from 'lucide-react-native';
import { COLORS, OUTCOME_BADGE_STYLES } from '../../lib/theme';
import type { TeamMeetingPreview } from '../../types';

interface TeamMeetingRowProps {
  meeting: TeamMeetingPreview;
  onPress: (meetingId: string) => void;
}

export function TeamMeetingRow({ meeting, onPress }: TeamMeetingRowProps) {
  const badge = OUTCOME_BADGE_STYLES[meeting.outcome];

  return (
    <XStack
      alignItems="center"
      gap="$3"
      paddingVertical={13}
      paddingHorizontal={4}
      borderBottomWidth={2}
      borderBottomColor={COLORS.polar}
      onPress={() => onPress(meeting.id)}
      pressStyle={{ opacity: 0.7 }}
    >
      <View width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={COLORS.greenTint}>
        <Text fontSize={13} fontWeight="800" color={COLORS.ledgeGreen}>
          {meeting.agentInitials}
        </Text>
      </View>
      <YStack flex={1}>
        <Text fontWeight="800" fontSize={14} color={COLORS.eel}>
          {meeting.clientName}
        </Text>
        <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
          {meeting.agentName} · {meeting.date} · {meeting.time}
        </Text>
      </YStack>
      <View borderRadius={999} paddingHorizontal={10} paddingVertical={3} backgroundColor={badge.background}>
        <Text fontSize={10.5} fontWeight="800" color={badge.color}>
          {meeting.outcome}
        </Text>
      </View>
      <ChevronRight size={16} color={COLORS.swanLedge} />
    </XStack>
  );
}
