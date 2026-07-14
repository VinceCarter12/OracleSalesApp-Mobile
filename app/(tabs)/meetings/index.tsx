import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Handshake } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { COLORS, OUTCOME_BADGE_STYLES } from '../../../lib/theme';
import { useMeetings } from '../../../lib/useMeetings';
import { LockButton } from '../../../components/security/LockButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SelectTile } from '../../../components/ui/SelectTile';
import { DuoButton } from '../../../components/ui/DuoButton';
import { MEETING_OUTCOMES, type Meeting, type MeetingOutcome } from '../../../types';

type OutcomeFilter = MeetingOutcome | 'all';

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const outcomeStyle = meeting.outcome ? OUTCOME_BADGE_STYLES[meeting.outcome] : null;
  return (
    <Pressable onPress={() => router.push(`/(tabs)/meetings/${meeting.id}`)}>
      <XStack
        alignItems="center"
        gap="$3"
        paddingVertical={13}
        paddingHorizontal={4}
        borderBottomWidth={2}
        borderBottomColor={COLORS.polar}
      >
        <YStack flex={1} gap="$0.5">
          <Text fontWeight="800" fontSize={14} color={COLORS.eel}>
            {meeting.client_name ?? 'Unknown Client'}
          </Text>
          <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
            {new Date(meeting.logged_at).toLocaleString()}
          </Text>
        </YStack>
        {outcomeStyle && meeting.outcome ? (
          <StatusBadge label={meeting.outcome} {...outcomeStyle} />
        ) : (
          <StatusBadge label="Photo visit" background={COLORS.greenTint} color={COLORS.ledgeGreen} />
        )}
      </XStack>
    </Pressable>
  );
}

export default function MeetingsScreen() {
  const insets = useSafeAreaInsets();
  const { meetings, loading, refresh } = useMeetings();
  const [filter, setFilter] = useState<OutcomeFilter>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? meetings : meetings.filter((m) => m.outcome === filter)),
    [meetings, filter]
  );

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>My Meetings</Text>
        <XStack marginLeft="auto"><LockButton /></XStack>
      </XStack>

      <XStack paddingHorizontal="$4" gap="$2" flexWrap="wrap" marginBottom="$2.5">
        <SelectTile label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        {MEETING_OUTCOMES.map((outcome) => (
          <SelectTile
            key={outcome}
            label={outcome}
            selected={filter === outcome}
            onPress={() => setFilter(outcome)}
          />
        ))}
      </XStack>

      {loading && !meetings.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={COLORS.feather} />
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4 }}
          renderItem={({ item }) => <MeetingRow meeting={item} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8" gap="$2.5">
              <Handshake size={40} color={COLORS.hare} />
              <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center">
                {meetings.length === 0 ? 'No meetings recorded yet.' : 'Walang tumugma sa filter.'}
              </Text>
            </YStack>
          }
        />
      )}

      <YStack paddingHorizontal="$4" paddingBottom="$3">
        <DuoButton label="+ Record Meeting" onPress={() => router.push('/(tabs)/meetings/select-client')} />
      </YStack>
    </YStack>
  );
}
