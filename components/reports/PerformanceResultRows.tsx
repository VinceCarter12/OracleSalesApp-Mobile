import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, OUTCOME_BADGE_STYLES } from '../../lib/theme';
import { StatusBadge } from '../ui/StatusBadge';
import type { Client, Meeting } from '../../types';

/** Reports screen drill-down panel row — one meeting, tap through to its full record. */
export function ResultMeetingRow({ meeting }: { meeting: Meeting }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const outcomeStyle = meeting.outcome ? OUTCOME_BADGE_STYLES[meeting.outcome] : null;
  return (
    <Pressable onPress={() => router.push(`/(tabs)/meetings/${meeting.id}`)}>
      <XStack
        alignItems="center"
        gap="$3"
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={16}
        marginBottom={10}
      >
        <YStack flex={1} gap="$0.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
            {meeting.client_name ?? 'Unknown Client'}
          </Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {new Date(meeting.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' · '}
            {new Date(meeting.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </YStack>
        {outcomeStyle && meeting.outcome ? (
          <StatusBadge label={meeting.outcome} {...outcomeStyle} />
        ) : (
          <StatusBadge label="Photo visit" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
        )}
      </XStack>
    </Pressable>
  );
}

/** Reports screen drill-down panel row — one newly-acquired client, tap through to its detail page. */
export function ResultClientRow({ client }: { client: Client }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <Pressable onPress={() => router.push(`/(tabs)/clients/${client.id}`)}>
      <XStack
        alignItems="center"
        gap="$3"
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={16}
        marginBottom={10}
      >
        <YStack flex={1} gap="$0.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.company_name}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {client.contact_person || 'Walang contact person pa'}
          </Text>
        </YStack>
      </XStack>
    </Pressable>
  );
}
