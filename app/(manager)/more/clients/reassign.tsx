import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../../lib/theme';
import { AGENT_COLORS, getManagerAgents, agentById, clientById } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { TopBar } from '../../../../components/ui/TopBar';
import { DuoButton } from '../../../../components/ui/DuoButton';

/** Wireframe s-reassign — gated: pick a new agent, submits a reassignment approval. */
export default function ReassignClientScreen() {
  const { unlocked } = useGate();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { clients, requestReassign } = useManagerStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  if (!unlocked) return <SecurityGate />;

  const client = clients.find((c) => c.id === clientId) ?? clientById(clientId);
  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Text>Client not found.</Text>
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
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Reassign Client" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <YStack backgroundColor={COLORS.polar} borderRadius={16} padding="$3.5" marginBottom="$3.5">
          <Text fontSize={12.5} fontWeight="800" color={COLORS.eel}>{client.name}</Text>
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop={4}>
            Kasalukuyang agent: <Text color={COLORS.eel} fontWeight="800">{currentAgent?.name}</Text>
          </Text>
        </YStack>

        <Text fontSize={16} fontWeight="800" color={COLORS.eel} marginBottom="$2.5">Piliin ang bagong agent</Text>
        {candidates.map((a) => {
          const color = AGENT_COLORS[a.id];
          const selected = selectedAgentId === a.id;
          return (
            <XStack
              key={a.id}
              alignItems="center"
              gap="$3"
              backgroundColor={selected ? COLORS.greenTint : COLORS.snow}
              borderWidth={2}
              borderColor={selected ? COLORS.feather : COLORS.swan}
              borderRadius={16}
              padding="$3"
              marginBottom="$2.5"
              onPress={() => setSelectedAgentId(a.id)}
            >
              <View width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={color.background}>
                <Text fontWeight="800" fontSize={16} color={color.color}>{a.initials}</Text>
              </View>
              <YStack flex={1}>
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{a.name}</Text>
                <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf}>{a.activeClients} clients</Text>
              </YStack>
              <View width={20} height={20} borderRadius={10} borderWidth={2} borderColor={selected ? COLORS.feather : COLORS.swan} backgroundColor={selected ? COLORS.feather : 'transparent'} />
            </XStack>
          );
        })}

        <YStack marginTop="$4">
          <DuoButton label="Confirm Reassignment" disabled={!selectedAgentId} onPress={confirm} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
