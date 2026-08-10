import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useExecutiveOverview } from '../../../lib/use-executive-overview';
import { avatarPaletteFor } from '../../../lib/avatar-palette';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/**
 * Wireframe x-teams — ALL managers company-wide (ADR-014). Gated by the root
 * `LockGate` (Batch 5 Slice 3, ADR-051) — Executive is in scope for the
 * app-root lock, replacing this screen's former inline `useGate()`/
 * `SecurityGate` passcode gate. B-054 Phase 2: real data via
 * lib/use-executive-overview.ts. 2026-07-23: the Sales-vs-RSR team-level
 * "track" concept (ADR-017) is retired — teams are mixed, no longer shown
 * as separate tracks.
 */
export default function ExecutiveTeamsScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useExecutiveOverview();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Teams" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          All managers company-wide — including the size of each one’s team.
        </Text>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
            <BizButton small label="Retry" variant="white" onPress={reload} />
          </YStack>
        ) : !overview || overview.managers.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              No managers recorded.
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
                    <StatusBadge label="Manager" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
                  </XStack>
                  <XStack gap="$2.5">
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                      <Text color={BIZLINK_COLORS.brand}>{manager.agentCount}</Text> agents
                    </Text>
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                      <Text color={BIZLINK_COLORS.brand}>{manager.meetings}</Text> meetings
                    </Text>
                    <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                      <Text color={BIZLINK_COLORS.brand}>{manager.clients}</Text> clients
                    </Text>
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
