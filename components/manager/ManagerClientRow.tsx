import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../lib/client-status';
import { avatarPaletteFor } from '../../lib/avatar-palette';
import { initialsFromName } from '../../lib/display-name';
import { computeTeamClientProgress } from '../../lib/team-remote-mappers';
import { BizCard } from '../bizlink/BizCard';
import { StatusBadge } from '../ui/StatusBadge';
import { Avatar } from '../ui/Avatar';
import type { TeamAgent, TeamClient, TeamMeeting } from '../../types';

/**
 * Row anatomy mirrors Sales' `ClientRow` (app/(tabs)/clients/index.tsx) —
 * row number → company name → detail line → meta row (status pill) →
 * progress bar (Prospect/In Progress only) — plus the agent Avatar Sales
 * doesn't need, since every row here can belong to a different agent.
 * Extracted out of `app/(manager)/more/clients/index.tsx` to keep that
 * route file under this repo's 300-line cap (2026-08-22, Guest Records).
 */
export function ManagerClientRow({ client, rowNumber, agents, meetings }: { client: TeamClient; rowNumber: number; agents: TeamAgent[]; meetings: TeamMeeting[] }) {
  const agent = agents.find((a) => a.id === client.agentId);
  // Guest Records (2026-08-22): a held client's owning agent is on another
  // team, never in `agents` (team roster + self) — fall back to the name
  // carried on the client row itself, same fallback pattern B-131 uses for
  // `TeamMeeting.tagAlongOwnerAgentName`.
  const agentName = agent?.name ?? client.guestOwnerAgentName ?? 'Unassigned';
  const agentInitials = agent?.initials ?? (client.guestOwnerAgentName ? initialsFromName(client.guestOwnerAgentName) : '—');
  const color = avatarPaletteFor(client.agentId);
  const progress = computeTeamClientProgress(client, meetings);
  const showsProgress = client.status === 'prospect' || client.status === 'in_progress';
  return (
    <Pressable onPress={() => router.push(`/(manager)/more/clients/${client.id}`)}>
      <BizCard gap="$1.5" paddingVertical={16} paddingHorizontal={18} marginBottom={10}>
        <XStack alignItems="center" gap="$2.5">
          <YStack width={26} height={26} borderRadius={13} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center" flexShrink={0}>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>{rowNumber}</Text>
          </YStack>
          <Avatar initials={agentInitials} size="sm" background={color.background} color={color.color} />
          <Text flex={1} fontFamily={BIZLINK_FONTS.semibold} fontSize={15} letterSpacing={-0.2} color={BIZLINK_COLORS.text}>{client.name}</Text>
        </XStack>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$1">
          {agentName} · {client.channel}
        </Text>

        <XStack alignItems="center" gap="$2" marginTop="$1.5" flexWrap="wrap">
          {client.deadlineWarn ? (
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Deadline <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.red}>{client.deadline}</Text>
            </Text>
          ) : null}
          <StatusBadge {...CLIENT_STATUS_BADGES[client.status]} />
          <Text color={BIZLINK_COLORS.muted} fontSize={16} marginLeft="auto">›</Text>
        </XStack>

        {showsProgress ? (
          <YStack marginTop="$1.5" gap="$1">
            <XStack alignItems="center" gap="$2.5">
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Qualified agenda progress</Text>
              <YStack flex={1} height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.soft} overflow="hidden">
                <YStack height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.brand} width={`${progress}%`} />
              </YStack>
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{progress}%</Text>
            </XStack>
          </YStack>
        ) : null}
      </BizCard>
    </Pressable>
  );
}
