import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Bell, Ellipsis, Hourglass, PencilLine, UserRound, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, OUTCOME_BADGE_STYLES } from '../../lib/theme';
import { managerProfile } from '../../lib/manager-data';
import { useManagerDashboard } from '../../lib/useManagerDashboard';
import { useManagerStore } from '../../lib/manager-store';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizStatCard } from '../../components/bizlink/BizStatCard';
import { BizHeroCard } from '../../components/bizlink/BizHeroCard';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizQuickAction } from '../../components/bizlink/BizQuickAction';
import { AvatarStatusRing } from '../../components/bizlink/AvatarStatusRing';
import { SyncStatusChip } from '../../components/sync/SyncStatusChip';
import { SyncCenterSheet } from '../../components/sync/SyncCenterSheet';
import type { TeamAgent, TeamMeetingPreview } from '../../types';

// T-014 Phase 3 (ADR-024): local, Manager-Home-only replacements for
// `components/manager/TeamAvatarStrip.tsx` / `TeamMeetingRow.tsx` — those two
// shared files are still consumed by `app/(executive)/index.tsx` (Phase 4,
// not yet migrated), so they're left on the old `COLORS` palette rather than
// touched in place (same "bypass the shared shell" precedent Phase 2 used
// for `components/account/AccountScreen.tsx`).

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

function RecentMeetingRow({ meeting, onPress }: { meeting: TeamMeetingPreview; onPress: () => void }) {
  const badge = OUTCOME_BADGE_STYLES[meeting.outcome];
  return (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      padding={14}
      marginBottom={10}
      onPress={onPress}
      pressStyle={{ opacity: 0.85 }}
    >
      <Avatar initials={meeting.agentInitials} size="sm" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
      <YStack flex={1} gap="$0.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{meeting.clientName}</Text>
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          {meeting.agentName} · {meeting.date} · {meeting.time}
        </Text>
      </YStack>
      <StatusBadge label={meeting.outcome} background={badge.background} color={badge.color} />
    </XStack>
  );
}

/** Wireframe s-home — real cross-agent Supabase data (ADR-021); manager's own-device sync chip (ADR-022 Phase D scope, not team-wide). */
export default function ManagerDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { summary, loading } = useManagerDashboard();
  const { approvals } = useManagerStore();
  const profile = managerProfile();
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);

  if (loading || !summary) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  const approvalBadge = approvals.length || summary.pendingApprovals;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <AvatarStatusRing>
          <Avatar
            initials={profile.fullName.split(' ').map((part) => part[0]).join('')}
            background={BIZLINK_COLORS.tintA}
            color={BIZLINK_COLORS.ink}
          />
        </AvatarStatusRing>
        <YStack gap="$1">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15.5} color={BIZLINK_COLORS.text}>
            Good morning, {summary.managerName}!
          </Text>
          <StatusBadge label={profile.title} background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
        </YStack>
        <Pressable onPress={() => router.push('/(manager)/approvals')} style={{ marginLeft: 'auto' }} hitSlop={6}>
          <YStack width={44} height={44} borderRadius={22} backgroundColor={BIZLINK_COLORS.card} alignItems="center" justifyContent="center" position="relative">
            <Bell size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            {approvalBadge > 0 ? (
              <YStack position="absolute" top={9} right={10} width={8} height={8} borderRadius={4} backgroundColor={BIZLINK_COLORS.red} />
            ) : null}
          </YStack>
        </Pressable>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        <XStack gap={10} marginTop={6}>
          <YStack flex={1}>
            <BizStatCard
              tone="tintA"
              value={summary.teamProspects}
              label="Team Prospects"
              caption="+3 this week"
              onPress={() => router.push('/(manager)/more/clients')}
            />
          </YStack>
          <YStack flex={1}>
            <BizStatCard
              tone="white"
              value={summary.teamClients}
              label="Team Clients"
              caption="+12.1% vs last mo."
              onPress={() => router.push('/(manager)/more/clients')}
            />
          </YStack>
        </XStack>
        <XStack gap={10} marginTop={10}>
          <YStack flex={1}>
            <BizStatCard
              tone="white"
              value={summary.agentCount}
              label="Agents"
              caption="your team"
              onPress={() => router.push('/(manager)/team')}
            />
          </YStack>
          <YStack flex={1}>
            <BizStatCard
              tone="white"
              value={summary.pendingApprovals}
              label="Pending approvals"
              caption="edits + reassignments"
              onPress={() => router.push('/(manager)/approvals')}
            />
          </YStack>
        </XStack>

        <BizHeroCard
          value={summary.teamMeetings}
          unit="meetings"
          label="Team meetings this month"
          caption={`${summary.teamMeetingsSuccessful} successful`}
          onPress={() => router.push('/(manager)/more/meetings')}
        />

        <BizSectionHeader title="Quick Actions" />
        <XStack gap="$2.5" flexWrap="wrap">
          <BizQuickAction
            icon={<PencilLine size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Approvals"
            badgeCount={summary.pendingApprovals}
            onPress={() => router.push('/(manager)/approvals')}
          />
          <BizQuickAction
            icon={<Users size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Tag-Along"
            badgeCount={summary.pendingTagAlongRequests}
            onPress={() => router.push('/(manager)/tag-along')}
          />
          <BizQuickAction
            icon={<UserRound size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="My Team"
            onPress={() => router.push('/(manager)/team')}
          />
          <BizQuickAction
            icon={<Ellipsis size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="More"
            onPress={() => router.push('/(manager)/more')}
          />
        </XStack>

        {/* T-014 Phase 3 (ADR-022 Phase D scope): manager's OWN device outbox
            only — same SyncStatusChip/SyncCenterSheet as the Sales Agent Home,
            never team-wide (device_sync_status heartbeat is Phase E, not
            committed). The old mock "records pending sync" banner
            (`summary.pendingSyncRecords`, always 0 per ADR-021) is replaced by
            this real per-device chip. */}
        <SyncStatusChip onPress={() => setSyncSheetOpen(true)} />

        {summary.deadlineWarningCount > 0 ? (
          <XStack
            alignItems="center"
            gap="$2.5"
            backgroundColor={BIZLINK_COLORS.tintB}
            borderRadius={24}
            paddingHorizontal={16}
            paddingVertical={14}
            marginTop={10}
            onPress={() => router.push('/(manager)/more/clients')}
          >
            <Hourglass size={18} color={BIZLINK_COLORS.red} strokeWidth={1.75} />
            <YStack flex={1}>
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.red}>
                {summary.deadlineWarningCount} prospects across the team: info deadline malapit na
              </Text>
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red}>1-month rule — kumpletuhin o auto-delete</Text>
            </YStack>
          </XStack>
        ) : null}

        <BizSectionHeader title="My Team" actionLabel="Tingnan lahat" onAction={() => router.push('/(manager)/team')} />
        <XStack gap="$3.5">
          {summary.agents.map((agent) => (
            <TeamAvatarPreview key={agent.id} agent={agent} onPress={() => router.push(`/(manager)/team/${agent.id}`)} />
          ))}
        </XStack>

        <BizSectionHeader title="Recent Team Meetings" actionLabel="Tingnan lahat" onAction={() => router.push('/(manager)/more/meetings')} />
        {summary.recentMeetings.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">
            Wala pang meeting na naitala ng team.
          </Text>
        ) : (
          summary.recentMeetings.map((meeting) => (
            <RecentMeetingRow key={meeting.id} meeting={meeting} onPress={() => router.push(`/(manager)/more/meetings/${meeting.id}`)} />
          ))
        )}
      </ScrollView>

      <SyncCenterSheet visible={syncSheetOpen} onClose={() => setSyncSheetOpen(false)} />
    </YStack>
  );
}
