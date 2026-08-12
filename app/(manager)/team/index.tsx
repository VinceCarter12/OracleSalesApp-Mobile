import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useTeamOverview } from '../../../lib/use-team-overview';
import { avatarPaletteFor } from '../../../lib/avatar-palette';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFilterScroll } from '../../../components/bizlink/BizFilterScroll';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { Avatar } from '../../../components/ui/Avatar';
import { TEAM_FILTER_OPTIONS, filterTeamAgents, type TeamFilterValue } from '../../../lib/team-attention-filter';
import { PAGINATION_PAGE_SIZE, usePagination } from '../../../lib/use-pagination';

/** Wireframe s-team — ungated: staff stats only, no client data, so no fingerprint needed. Real data (B-054 Phase 1). */
export default function ManagerTeamScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useTeamOverview();
  const [filter, setFilter] = useState<TeamFilterValue>('all');
  const shownAgents = useMemo(() => filterTeamAgents(overview?.agents ?? [], filter), [overview, filter]);
  const { page, totalPages, pageItems, setPage } = usePagination(shownAgents, filter, PAGINATION_PAGE_SIZE);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="My Team" fallbackHref="/(manager)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Here you'll see every agent under you — each one's stats, so you can tell who needs help.
          (These are staff stats only — no customer data, so no fingerprint is needed.)
        </Text>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {error}
            </Text>
            <BizButton small label="Try again" variant="white" onPress={reload} />
          </YStack>
        ) : !overview || overview.agents.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              No agents are assigned to your team yet.
            </Text>
          </YStack>
        ) : (
          <>
            <YStack marginBottom="$2.5">
              <BizFilterScroll options={TEAM_FILTER_OPTIONS} value={filter} onChange={setFilter} />
            </YStack>
            {shownAgents.length === 0 ? (
              <YStack alignItems="center" paddingVertical="$6">
                <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  No team member matches this filter.
                </Text>
              </YStack>
            ) : (
              pageItems.map((agent, index) => {
                const color = avatarPaletteFor(agent.id);
                return (
                  <XStack
                    key={agent.id}
                    alignItems="center"
                    gap="$3"
                    backgroundColor={BIZLINK_COLORS.card}
                    borderRadius={20}
                    padding={14}
                    marginBottom={10}
                    onPress={() => router.push(`/(manager)/team/${agent.id}`)}
                    pressStyle={{ opacity: 0.85 }}
                  >
                    <YStack
                      width={26}
                      height={26}
                      borderRadius={13}
                      backgroundColor={BIZLINK_COLORS.tintA}
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>
                        {(page - 1) * PAGINATION_PAGE_SIZE + index + 1}
                      </Text>
                    </YStack>
                    <Avatar initials={agent.initials} background={color.background} color={color.color} />
                    <YStack flex={1}>
                      <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{agent.name}</Text>
                      <XStack gap="$2.5" marginTop={3}>
                        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                          <Text color={BIZLINK_COLORS.brand}>{agent.meetingsThisMonth}</Text> meetings
                        </Text>
                        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                          <Text color={BIZLINK_COLORS.brand}>{agent.activeClients}</Text> clients
                        </Text>
                        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                          <Text color={BIZLINK_COLORS.brand}>{agent.successRate}%</Text> success
                        </Text>
                      </XStack>
                    </YStack>
                    <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
                  </XStack>
                );
              })
            )}
          </>
        )}
      </ScrollView>
      {shownAgents.length > 0 ? (
        <BizFloatingPager page={page} totalPages={totalPages} onPageChange={setPage} bottomOffset={insets.bottom + 16} />
      ) : null}
    </YStack>
  );
}
