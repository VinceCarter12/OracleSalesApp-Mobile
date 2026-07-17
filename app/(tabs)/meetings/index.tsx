import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Handshake, Plus } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { OUTCOME_BADGE_STYLES, BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useMeetings } from '../../../lib/useMeetings';
import { BizLockButton } from '../../../components/bizlink/BizLockButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { BizChip } from '../../../components/bizlink/BizChip';
import { MEETING_OUTCOMES, type Meeting, type MeetingOutcome } from '../../../types';

// NOTE: same as clients/index.tsx — SyncBadge was NOT added to these rows.
// Meeting (types/index.ts) has no sync_status field; sync state lives only
// in the outbox table with no per-entity lookup exposed today. Flagged in
// the Phase 2 handoff report rather than invented here.

type OutcomeFilter = MeetingOutcome | 'all';

function MeetingRow({ meeting }: { meeting: Meeting }) {
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
            {new Date(meeting.logged_at).toLocaleString()}
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

export default function MeetingsScreen() {
  const insets = useSafeAreaInsets();
  const { meetings, loading, refresh } = useMeetings();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const [filter, setFilter] = useState<OutcomeFilter>('all');
  const [search, setSearch] = useState('');

  // NOTE: matches the wireframe's "company or location" search intent, but
  // `Meeting` (types/index.ts) has no readable location field today — the
  // meeting-location local-save is a separate known gap ("meeting contact/
  // location/remarks local-save fix", tracked outside this pass). Filters on
  // company name (client_name) only until that lands.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return meetings.filter((m) => {
      if (filter !== 'all' && m.outcome !== filter) return false;
      if (query && !(m.client_name ?? '').toLowerCase().includes(query)) return false;
      return true;
    });
  }, [meetings, filter, search]);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={26} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>My Meetings</Text>
        <XStack marginLeft="auto" gap="$2" alignItems="center">
          <Pressable
            onPress={() => router.push('/(tabs)/meetings/select-client')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: BIZLINK_COLORS.brand,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 10,
              minHeight: 44,
            }}
          >
            <Plus size={14} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>Record Meeting</Text>
          </Pressable>
          <BizLockButton />
        </XStack>
      </XStack>

      <YStack paddingHorizontal="$4" marginBottom="$2.5">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by company name…"
          placeholderTextColor={BIZLINK_COLORS.muted}
          style={{
            height: 52,
            borderRadius: 16,
            paddingHorizontal: 16,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            backgroundColor: BIZLINK_COLORS.card,
          }}
        />
      </YStack>

      <XStack paddingHorizontal="$4" gap="$2" flexWrap="wrap" marginBottom="$2.5">
        <BizChip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        {MEETING_OUTCOMES.map((outcome) => (
          <BizChip
            key={outcome}
            label={outcome}
            selected={filter === outcome}
            onPress={() => setFilter(outcome)}
          />
        ))}
      </XStack>

      {loading && !meetings.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
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
              <Handshake size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
                {meetings.length === 0 ? 'No meetings recorded yet.' : 'Walang tumugma sa filter.'}
              </Text>
            </YStack>
          }
        />
      )}
    </YStack>
  );
}
