import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { EXEC_MANAGERS } from '../../../lib/executive-data';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { LockButton } from '../../../components/security/LockButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/** Wireframe x-teams — gated: ALL managers company-wide, Sales + RSR tracks together (ADR-014). */
export default function ExecutiveTeamsScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();

  if (!unlocked) return <SecurityGate />;

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>Teams</Text>
        <XStack marginLeft="auto"><LockButton /></XStack>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3" lineHeight={19}>
          Lahat ng managers sa buong kumpanya — Sales at RSR (ADR-014) — kasama ang laki ng kanya-kanyang team.
          Executive lang ang nakakakita ng dalawang tracks nang magkasama.
        </Text>
        {EXEC_MANAGERS.map((manager) => (
          <Pressable key={manager.id} onPress={() => router.push(`/(executive)/teams/${manager.id}`)}>
            <XStack
              alignItems="center"
              gap="$3"
              backgroundColor={COLORS.snow}
              borderWidth={2}
              borderColor={COLORS.swan}
              borderRadius={16}
              padding="$3.5"
              marginBottom="$2.5"
            >
              <View width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={manager.avatar.background}>
                <Text fontWeight="800" fontSize={16} color={manager.avatar.color}>{manager.initials}</Text>
              </View>
              <YStack flex={1} gap="$1">
                <XStack alignItems="center" gap="$1.5" flexWrap="wrap">
                  <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{manager.name}</Text>
                  {manager.track === 'rsr' ? (
                    <StatusBadge label="RSR Manager" background={COLORS.greenTint} color={COLORS.ledgeGreen} />
                  ) : (
                    <StatusBadge label="Sales Manager" background={COLORS.purpleSoft} color={COLORS.purple} />
                  )}
                </XStack>
                <XStack gap="$2.5">
                  <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf}>
                    <Text color={COLORS.ledgeGreen}>{manager.agentCount}</Text> agents
                  </Text>
                  <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf}>
                    <Text color={COLORS.ledgeGreen}>{manager.meetings}</Text> meetings
                  </Text>
                  {manager.track === 'rsr' ? null : (
                    <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf}>
                      <Text color={COLORS.ledgeGreen}>{manager.clients}</Text> clients
                    </Text>
                  )}
                </XStack>
              </YStack>
              <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
            </XStack>
          </Pressable>
        ))}
      </ScrollView>
    </YStack>
  );
}
