import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { AGENT_COLORS, getManagerAgents, agentById, clientById } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { Avatar } from '../../../../components/ui/Avatar';

/** Wireframe s-reassign — pick a new agent, submits a reassignment approval. */
export default function ReassignClientScreen() {
  const insets = useSafeAreaInsets();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { clients, requestReassign } = useManagerStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const client = clients.find((c) => c.id === clientId) ?? clientById(clientId);
  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Client not found.</Text>
      </YStack>
    );
  }

  const currentAgent = agentById(client.agentId);
  const candidates = getManagerAgents().filter((a) => a.id !== client.agentId);

  function confirm(): void {
    if (!selectedAgentId) return;
    requestReassign(client!.id, selectedAgentId);
    router.back();
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Reassign Client" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} marginBottom="$3.5">
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{client.name}</Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={4}>
            Kasalukuyang agent: <Text color={BIZLINK_COLORS.text} fontFamily={BIZLINK_FONTS.semibold}>{currentAgent?.name}</Text>
          </Text>
        </YStack>

        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text} marginBottom="$2.5">Piliin ang bagong agent</Text>
        {candidates.map((a) => {
          const color = AGENT_COLORS[a.id];
          const selected = selectedAgentId === a.id;
          return (
            <XStack
              key={a.id}
              alignItems="center"
              gap="$3"
              backgroundColor={selected ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.card}
              borderRadius={20}
              padding={14}
              marginBottom={10}
              onPress={() => setSelectedAgentId(a.id)}
            >
              <Avatar initials={a.initials} background={color.background} color={color.color} />
              <YStack flex={1}>
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{a.name}</Text>
                <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>{a.activeClients} clients</Text>
              </YStack>
              <YStack
                width={20}
                height={20}
                borderRadius={10}
                borderWidth={2}
                borderColor={selected ? BIZLINK_COLORS.brand : BIZLINK_COLORS.line}
                backgroundColor={selected ? BIZLINK_COLORS.brand : 'transparent'}
              />
            </XStack>
          );
        })}

        <YStack marginTop="$4">
          <BizButton label="Confirm Reassignment" disabled={!selectedAgentId} onPress={confirm} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
