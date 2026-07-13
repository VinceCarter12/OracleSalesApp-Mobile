import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
import type { TeamAgent } from '../../types';

interface TeamAvatarStripProps {
  agents: TeamAgent[];
  onSelectAgent: (agentId: string) => void;
}

export function TeamAvatarStrip({ agents, onSelectAgent }: TeamAvatarStripProps) {
  return (
    <XStack gap="$3.5">
      {agents.map((agent) => (
        <YStack key={agent.id} alignItems="center" onPress={() => onSelectAgent(agent.id)} pressStyle={{ opacity: 0.7 }}>
          <View
            width={44}
            height={44}
            borderRadius={22}
            alignItems="center"
            justifyContent="center"
            backgroundColor={COLORS.greenTint}
          >
            <Text fontSize={16} fontWeight="800" color={COLORS.ledgeGreen}>
              {agent.initials}
            </Text>
          </View>
          <Text fontSize={10.5} fontWeight="600" color={COLORS.hare} marginTop={4}>
            {agent.name.split(' ')[0]}
          </Text>
        </YStack>
      ))}
    </XStack>
  );
}
