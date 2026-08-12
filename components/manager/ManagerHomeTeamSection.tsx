import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { Avatar } from '../ui/Avatar';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import type { TeamAgent } from '../../types';

// Extracted from app/(manager)/index.tsx to keep that file under the
// 300-line coding-standard cap — presentational-only, same "My Team" +
// "My Team" section, using the real `summary.agents` data.

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

type ManagerHomeTeamSectionProps = { agents: TeamAgent[] };

export function ManagerHomeTeamSection({ agents }: ManagerHomeTeamSectionProps) {
  return (
    <>
      <BizSectionHeader title="My Team" actionLabel="Tingnan lahat" onAction={() => router.push('/(manager)/team')} />
      <XStack gap="$3.5">
        {agents.map((agent) => (
          <TeamAvatarPreview key={agent.id} agent={agent} onPress={() => router.push(`/(manager)/team/${agent.id}`)} />
        ))}
      </XStack>
    </>
  );
}
