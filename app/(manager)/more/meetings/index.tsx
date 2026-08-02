import { useMemo, useState } from 'react';
import { FlatList, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useTeamOverview } from '../../../../lib/use-team-overview';
import { useManagerScope } from '../../../../lib/manager-scope-store';
import { useSession } from '../../../../lib/session-store';
import { initialsFromName } from '../../../../lib/display-name';
import { avatarPaletteFor } from '../../../../lib/avatar-palette';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { BizScopeFilter } from '../../../../components/bizlink/BizScopeFilter';
import { Avatar } from '../../../../components/ui/Avatar';
import { meetingBadge } from '../../../../lib/meeting-badge';
import { MANAGER_OUTCOMES, MANAGER_OUTCOME_LABELS, type ManagerOutcome } from '../../../../types';

type OutcomeFilter = ManagerOutcome | 'all';

/**
 * Wireframe s-meetings — filter by scope, agent, and outcome. Real data
 * (B-054 Phase 1). Scope filter added Batch 6 PR C (ADR-052 §G, closes
 * B-073) — matches Wireframe-Manager-BizLink.html's `renderMeetingsFull()`.
 */
export default function ManagerMeetingsScreen() {
  const insets = useSafeAreaInsets();
  const { scope } = useManagerScope();
  const { overview, loading, error, reload } = useTeamOverview(scope);
  const { profileId, fullName } = useSession();
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [lastScope, setLastScope] = useState(scope);

  // Wireframe's setMeetingScope() unconditionally clears the agent chip
  // selection on every scope change, not only while scope is 'mine' — e.g.
  // selecting agent X under 'team', switching to 'mine' and back to 'team'
  // should land on "All", not silently restore agent X's stale selection.
  // Reset during render (not a setState-in-useEffect sync) per this file's
  // existing pattern above.
  if (scope !== lastScope) {
    setLastScope(scope);
    setAgentFilter('all');
  }

  const meetings = overview?.meetings ?? [];
  const clients = overview?.clients ?? [];
  const agents = overview?.agents ?? [];
  // `overview.agents` is the team roster only — it never includes the
  // manager (same as `lib/manager-dashboard-service.ts`'s `agents`). 'mine'/
  // 'combined' scope can surface the manager's own meetings, so the per-row
  // agent lookup below needs the manager too, or their rows would render
  // "Unassigned" instead of the manager's own name.
  const agentsWithManager =
    profileId && fullName
      ? [...agents, { id: profileId, name: fullName, initials: initialsFromName(fullName), meetingsThisMonth: 0, activeClients: 0, successRate: 0 }]
      : agents;

  const filtered = useMemo(
    () =>
      meetings.filter(
        (m) =>
          (agentFilter === 'all' || m.agentId === agentFilter) &&
          (outcomeFilter === 'all' || m.outcome === outcomeFilter)
      ),
    [meetings, agentFilter, outcomeFilter]
  );

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sales History" />
      <YStack paddingHorizontal="$4" gap="$2">
        <BizScopeFilter />
        {/* Wireframe renderMeetingsFull(): `meetingAgentFilterWrap` is hidden
            when scope is 'mine' — a per-agent filter is meaningless once the
            list is already narrowed to the manager's own records. */}
        {scope !== 'mine' ? (
          <>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by agent</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2">
                <BizChip label="All" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
                {agents.map((a) => (
                  <BizChip key={a.id} label={a.name.split(' ')[0]} selected={agentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
                ))}
              </XStack>
            </ScrollView>
          </>
        ) : null}
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Filter by outcome</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            <BizChip label="All" selected={outcomeFilter === 'all'} onPress={() => setOutcomeFilter('all')} />
            {MANAGER_OUTCOMES.map((o) => (
              <BizChip key={o} label={MANAGER_OUTCOME_LABELS[o]} selected={outcomeFilter === o} onPress={() => setOutcomeFilter(o)} />
            ))}
          </XStack>
        </ScrollView>
      </YStack>

      {loading ? (
        <YStack alignItems="center" paddingVertical="$6">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : error ? (
        <YStack alignItems="center" paddingVertical="$6" gap="$3">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
          <BizButton small label="Ulitin" variant="white" onPress={reload} />
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
          renderItem={({ item }) => {
            const client = clients.find((c) => c.id === item.clientId);
            const agent = agentsWithManager.find((a) => a.id === item.agentId);
            const color = avatarPaletteFor(item.agentId);
            return (
              <XStack
                alignItems="center"
                gap="$3"
                backgroundColor={BIZLINK_COLORS.card}
                borderRadius={20}
                padding={14}
                marginBottom={10}
                onPress={() => router.push(`/(manager)/more/meetings/${item.id}`)}
              >
                <Avatar initials={agent?.initials ?? '—'} size="sm" background={color.background} color={color.color} />
                <YStack flex={1}>
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client?.name ?? 'Unknown client'}</Text>
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                    {agent?.name ?? 'Unassigned'} · {item.date} · {item.time}{item.meetingMode === 'online' ? ' · Online' : ''}
                  </Text>
                </YStack>
                <YStack alignItems="flex-end" gap="$1">
                  {meetingBadge(item)}
                  <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={item.synced ? BIZLINK_COLORS.brand : BIZLINK_COLORS.navy}>
                    {item.synced ? '✓ synced' : '↻ pending'}
                  </Text>
                </YStack>
              </XStack>
            );
          }}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8">
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Walang meeting na tumugma.</Text>
            </YStack>
          }
        />
      )}
    </YStack>
  );
}
