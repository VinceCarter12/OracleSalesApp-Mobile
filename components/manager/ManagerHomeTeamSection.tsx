import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, OUTCOME_BADGE_STYLES } from '../../lib/theme';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../ui/StatusBadge';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import type { TeamAgent, TeamMeetingPreview } from '../../types';

// Extracted from app/(manager)/index.tsx to keep that file under the
// 300-line coding-standard cap — presentational-only, same "My Team" +
// "Recent Team Meetings" sections, same real `summary.agents` /
// `summary.recentMeetings` data and routes as before the extraction.

function TeamAvatarPreview({ agent, onPress }: { agent: TeamAgent; onPress: () => void }) {
  return (
    <YStack alignItems="center" onPress={onPress} pressStyle={{ opacity: 0.7 }} gap="$1">
      <Avatar initials={agent.initials} background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
        {agent.name.split(' ')[0]}
      </Text>
    </YStack>
  );
}

function RecentMeetingRow({ meeting, onPress }: { meeting: TeamMeetingPreview; onPress: () => void }) {
  const badge = OUTCOME_BADGE_STYLES[meeting.outcome];
  return (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      padding={14}
      marginBottom={10}
      onPress={onPress}
      pressStyle={{ opacity: 0.85 }}
    >
      <Avatar initials={meeting.agentInitials} size="sm" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
      <YStack flex={1} gap="$0.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{meeting.clientName}</Text>
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          {meeting.agentName} · {meeting.date} · {meeting.time}
        </Text>
      </YStack>
      <StatusBadge label={meeting.outcome} background={badge.background} color={badge.color} />
    </XStack>
  );
}

type ManagerHomeTeamSectionProps = {
  agents: TeamAgent[];
  recentMeetings: TeamMeetingPreview[];
};

export function ManagerHomeTeamSection({ agents, recentMeetings }: ManagerHomeTeamSectionProps) {
  return (
    <>
      <BizSectionHeader title="My Team" actionLabel="Tingnan lahat" onAction={() => router.push('/(manager)/team')} />
      <XStack gap="$3.5">
        {agents.map((agent) => (
          <TeamAvatarPreview key={agent.id} agent={agent} onPress={() => router.push(`/(manager)/team/${agent.id}`)} />
        ))}
      </XStack>

      <BizSectionHeader title="Recent Team Meetings" actionLabel="Tingnan lahat" onAction={() => router.push('/(manager)/more/meetings')} />
      {recentMeetings.length === 0 ? (
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">
          Wala pang meeting na naitala ng team.
        </Text>
      ) : (
        recentMeetings.map((meeting) => (
          <RecentMeetingRow key={meeting.id} meeting={meeting} onPress={() => router.push(`/(manager)/more/meetings/${meeting.id}`)} />
        ))
      )}
    </>
  );
}
