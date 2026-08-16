import { Users } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BizCard } from '../bizlink/BizCard';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import type { MeetingAttendee } from '../../lib/meeting-attendee-policy';

export function MeetingAttendeeCard({ attendees }: { attendees: readonly MeetingAttendee[] }) {
  return (
    <BizCard marginTop="$3" gap="$2">
      <XStack alignItems="center" gap="$2">
        <Users size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>Tag-along attendees</Text>
        <Text fontFamily={BIZLINK_FONTS.medium} fontSize={12} color={BIZLINK_COLORS.muted}>{attendees.length} manager{attendees.length === 1 ? '' : 's'}</Text>
      </XStack>
      {attendees.map((attendee) => (
        <YStack key={attendee.id} paddingVertical="$1">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={12.5} color={BIZLINK_COLORS.text}>{attendee.name}</Text>
          <Text fontFamily={BIZLINK_FONTS.medium} fontSize={11.5} color={BIZLINK_COLORS.muted}>{attendee.label}</Text>
          <Text fontFamily={BIZLINK_FONTS.medium} fontSize={11.5} color={BIZLINK_COLORS.muted}>
            Decision: {attendee.status === 'accepted' ? 'Accepted' : attendee.status === 'declined' ? 'Declined' : attendee.status === 'pending' ? 'Pending' : attendee.status}
          </Text>
        </YStack>
      ))}
    </BizCard>
  );
}
