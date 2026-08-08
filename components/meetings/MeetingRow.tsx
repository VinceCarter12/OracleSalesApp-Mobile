import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Users } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { OUTCOME_BADGE_STYLES, useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { getClientStatus, SALES_CLIENT_STATUS_BADGES } from '../../lib/client-status';
import { getClientJourneyProgress } from '../../lib/client-progress';
import { formatMeetingLocation } from '../../lib/format-meeting-location';
import { StatusBadge } from '../ui/StatusBadge';
import { SyncBadge } from '../sync/SyncBadge';
import { BizCard } from '../bizlink/BizCard';
import type { OutboxStatus } from '../../lib/sync/outbox-status';
import type { Client, Meeting } from '../../types';

/**
 * Meeting Details list's card anatomy (Wireframe-Sales-BizLink.html's
 * `aRenderMeetingsFiltered` `.taskcard`, 2026-08-04 visual-parity handoff):
 * filtered-position number → company name → date·time·location(+tag-along
 * chip) → outcome/lifecycle/sync badges → qualified-agenda/lifecycle
 * progress row. Split out of app/(tabs)/meetings/index.tsx to keep that
 * screen file under the 300-line cap (.claude/rules/10-coding-standards.md).
 */
export function MeetingRow({
  meeting,
  client,
  meetings,
  hasTagAlong,
  rowNumber,
}: {
  meeting: Meeting;
  client: Client | undefined;
  meetings: Meeting[];
  hasTagAlong: boolean;
  rowNumber: number;
}) {
  const BIZLINK_COLORS = useBizlinkColors();
  const outcomeStyle = meeting.outcome ? OUTCOME_BADGE_STYLES[meeting.outcome] : null;
  const location = formatMeetingLocation(meeting);
  const descriptionParts = [
    new Date(meeting.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    new Date(meeting.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    location,
  ].filter(Boolean);

  const status = client ? getClientStatus(client) : null;
  const statusBadge = status ? SALES_CLIENT_STATUS_BADGES[status] : null;
  const journeyProgress = client ? getClientJourneyProgress(client, meetings) : null;

  return (
    <Pressable onPress={() => router.push(`/(tabs)/meetings/${meeting.id}`)}>
      <BizCard gap="$1.5" paddingVertical={16} paddingHorizontal={18} marginBottom={10}>
        <XStack alignItems="center" gap="$2.5">
          <YStack
            width={26}
            height={26}
            borderRadius={13}
            backgroundColor={BIZLINK_COLORS.soft}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
              {rowNumber}
            </Text>
          </YStack>
          <Text
            flex={1}
            fontFamily={BIZLINK_FONTS.semibold}
            fontSize={15}
            letterSpacing={-0.2}
            color={BIZLINK_COLORS.text}
          >
            {meeting.client_name ?? 'Unknown Client'}
          </Text>
        </XStack>

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

        <XStack alignItems="center" gap="$2" flexWrap="wrap">
          {outcomeStyle && meeting.outcome ? (
            <StatusBadge label={meeting.outcome} {...outcomeStyle} />
          ) : (
            <StatusBadge label="Photo visit" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
          )}
          {statusBadge ? <StatusBadge {...statusBadge} /> : null}
          {meeting.sync_status ? <SyncBadge status={meeting.sync_status as OutboxStatus} /> : null}
        </XStack>

        {journeyProgress ? (
          <XStack alignItems="center" gap="$2.5" marginTop="$1">
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {journeyProgress.label}
            </Text>
            <YStack flex={1} height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.soft} overflow="hidden">
              <YStack height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.brand} width={`${journeyProgress.percent}%`} />
            </YStack>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
              {journeyProgress.percent}%
            </Text>
          </XStack>
        ) : null}
      </BizCard>
    </Pressable>
  );
}
