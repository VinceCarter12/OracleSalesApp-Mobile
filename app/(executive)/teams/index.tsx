import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useExecutiveOverview } from '../../../lib/use-executive-overview';
import { avatarPaletteFor } from '../../../lib/avatar-palette';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { BizLockButton } from '../../../components/bizlink/BizLockButton';
import { BizButton } from '../../../components/bizlink/BizButton';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/**
 * Wireframe x-teams — ALL managers company-wide, Sales + RSR tracks
 * together (ADR-014). Gated (ADR-007) — the Manager-only 2026-07-17
 * amendment does NOT extend to Executive; Executive keeps the passcode gate.
 * B-054 Phase 2: real data via lib/use-executive-overview.ts.
 */
export default function ExecutiveTeamsScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { overview, loading, error, reload } = useExecutiveOverview();

  if (!unlocked) return <SecurityGate />;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={21} color={BIZLINK_COLORS.text}>Teams</Text>
        <XStack marginLeft="auto"><BizLockButton /></XStack>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Lahat ng managers sa buong kumpanya — Sales at RSR (ADR-014) — kasama ang laki ng kanya-kanyang team.
          Executive lang ang nakakakita ng dalawang tracks nang magkasama.
        </Text>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
            <BizButton small label="Ulitin" variant="white" onPress={reload} />
          </YStack>
        ) : !overview || overview.managers.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Walang manager na naitala.
            </Text>
          </YStack>
        ) : (
          overview.managers.map((manager) => {
            const color = avatarPaletteFor(manager.id);
            return (
              <XStack
                key={manager.id}
                alignItems="center"
                gap="$3"
                backgroundColor={BIZLINK_COLORS.card}
                borderRadius={20}
                padding={14}
                marginBottom={10}
                onPress={() => router.push(`/(executive)/teams/${manager.id}`)}
                pressStyle={{ opacity: 0.85 }}
              >
                <Avatar initials={manager.initials} background={color.background} color={color.color} />
                <YStack flex={1} gap="$1">
                  <XStack alignItems="center" gap="$1.5" flexWrap="wrap">
                    <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{manager.name}</Text>
                    {manager.track === 'rsr' ? (
                      <StatusBadge label="RSR Manager" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
                    ) : (
                      <StatusBadge label="Sales Manager" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
                    )}
                  </XStack>
                  <XStack gap="$2.5">
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                      <Text color={BIZLINK_COLORS.brand}>{manager.agentCount}</Text> agents
                    </Text>
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                      <Text color={BIZLINK_COLORS.brand}>{manager.meetings}</Text> meetings
                    </Text>
                    {manager.track === 'rsr' ? null : (
                      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                        <Text color={BIZLINK_COLORS.brand}>{manager.clients}</Text> clients
                      </Text>
                    )}
                  </XStack>
                </YStack>
                <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
              </XStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
