import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Calendar, Handshake, Plus, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { OUTCOME_BADGE_STYLES, useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { useMeetings } from '../../../lib/useMeetings';
import { useSession } from '../../../lib/session-store';
import { getMyCompanionRequests } from '../../../lib/tag-along-service';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SyncBadge } from '../../../components/sync/SyncBadge';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizChip } from '../../../components/bizlink/BizChip';
import type { OutboxStatus } from '../../../lib/sync/outbox-status';
import { MEETING_OUTCOMES, type Meeting, type MeetingOutcome } from '../../../types';

/** Mirrors [id].tsx's `formatMeetingLocation` — human-readable Location line for the row description. */
function formatMeetingLocation(meeting: Meeting): string | null {
  if (!meeting.location_type) return null;
  return meeting.location_type === 'Others' ? (meeting.location_name || 'Others') : 'Client Office';
}

type OutcomeFilter = MeetingOutcome | 'all';

// Wireframe a-meetings' static "Jul 2026"-style month chip (~line 722) — a
// decorative/informational label, not an interactive picker (confirmed
// non-interactive in the wireframe JS: no onclick handler). Computed from
// the current date, matching the wireframe's simplicity. Moved to the LEFT
// of the header row (2026-07-21) per Vince's placement correction.
function currentMonthLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function MeetingRow({ meeting, hasTagAlong }: { meeting: Meeting; hasTagAlong: boolean }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const outcomeStyle = meeting.outcome ? OUTCOME_BADGE_STYLES[meeting.outcome] : null;
  const location = formatMeetingLocation(meeting);
  const descriptionParts = [
    new Date(meeting.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    new Date(meeting.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    location,
  ].filter(Boolean);

  return (
    <Pressable onPress={() => router.push(`/(tabs)/meetings/${meeting.id}`)}>
      <BizCard gap="$1.5" paddingVertical={16} paddingHorizontal={18} marginBottom={10}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15} letterSpacing={-0.2} color={BIZLINK_COLORS.text}>
          {meeting.client_name ?? 'Unknown Client'}
        </Text>
        <XStack alignItems="center" gap="$1.5">
          <Text
            flexShrink={1}
            minWidth={0}
            numberOfLines={1}
            ellipsizeMode="tail"
            fontSize={11.5}
            fontFamily={BIZLINK_FONTS.medium}
            color={BIZLINK_COLORS.muted}
          >
            {descriptionParts.join(' · ')}
          </Text>
          {hasTagAlong ? (
            <XStack
              flexShrink={0}
              alignItems="center"
              gap="$1"
              backgroundColor={BIZLINK_COLORS.soft}
              borderRadius={999}
              paddingHorizontal={8}
              paddingVertical={2}
            >
              <Users size={10} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
              <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.navy}>tag-along</Text>
            </XStack>
          ) : null}
        </XStack>
        <XStack alignItems="center" gap="$2">
          {outcomeStyle && meeting.outcome ? (
            <StatusBadge label={meeting.outcome} {...outcomeStyle} />
          ) : (
            <StatusBadge label="Photo visit" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
          )}
          {meeting.sync_status ? <SyncBadge status={meeting.sync_status as OutboxStatus} /> : null}
        </XStack>
      </BizCard>
    </Pressable>
  );
}

export default function MeetingsScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { meetings, loading, refresh } = useMeetings();
  const { profileId } = useSession();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const [filter, setFilter] = useState<OutcomeFilter>('all');
  const [search, setSearch] = useState('');
  const [tagAlongMeetingIds, setTagAlongMeetingIds] = useState<Set<string>>(new Set());

  // Bulk-loaded once (not per-row) to avoid an N+1 query per list render —
  // builds a lookup of which meetings have an attached companion request,
  // for the list row's inline "tag-along" chip (Wireframe a-meetings).
  useFocusEffect(
    useCallback(() => {
      if (!profileId) return;
      getMyCompanionRequests(profileId)
        .then((requests) => {
          setTagAlongMeetingIds(new Set(requests.filter((r) => r.relatedMeetingId).map((r) => r.relatedMeetingId as string)));
        })
        .catch((err) => console.error('[MyMeetings] tag-along lookup failed:', err instanceof Error ? err.message : String(err)));
    }, [profileId])
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return meetings.filter((m) => {
      if (filter !== 'all' && m.outcome !== filter) return false;
      if (!query) return true;
      const location = formatMeetingLocation(m) ?? '';
      return (m.client_name ?? '').toLowerCase().includes(query) || location.toLowerCase().includes(query);
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
            <Plus size={14} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Record Meeting</Text>
          </Pressable>
        </XStack>
      </XStack>

      <XStack paddingHorizontal="$4" justifyContent="flex-start">
        <XStack
          alignItems="center"
          gap="$1.5"
          backgroundColor={BIZLINK_COLORS.card}
          borderRadius={999}
          paddingHorizontal={13}
          paddingVertical={7}
        >
          <Calendar size={12} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {currentMonthLabel()}
          </Text>
        </XStack>
      </XStack>

      <YStack paddingHorizontal="$4" marginTop="$2" marginBottom="$2.5">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search company or location…"
          placeholderTextColor={BIZLINK_COLORS.muted}
          style={{
            height: 52,
            borderRadius: 16,
            paddingHorizontal: 16,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            backgroundColor: BIZLINK_COLORS.card,
            borderWidth: 1,
            borderColor: BIZLINK_COLORS.line,
          }}
        />
      </YStack>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        <XStack gap="$2" marginBottom="$2.5">
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
      </ScrollView>

      {loading && !meetings.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}
          renderItem={({ item }) => <MeetingRow meeting={item} hasTagAlong={tagAlongMeetingIds.has(item.id)} />}
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
