import { useCallback, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  Building2,
  Camera,
  ClipboardList,
  Handshake,
  Hourglass,
  Magnet,
  Plus,
  Target,
  Users,
} from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { useClients } from '../../lib/useClients';
import { useMeetings } from '../../lib/useMeetings';
import { getClientStatus, CLIENT_STATUS_BADGES, WAITING_MANAGER_APPROVAL_BADGE } from '../../lib/client-status';
import { getClientIdsWithPendingManagerTagAlong } from '../../lib/tag-along-service';
import { countCreatedSince } from '../../lib/team-remote-mappers';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizStatCard } from '../../components/bizlink/BizStatCard';
import { BizHeroCard } from '../../components/bizlink/BizHeroCard';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizDashboardAlert } from '../../components/bizlink/BizDashboardAlert';
import { BizQuickAction } from '../../components/bizlink/BizQuickAction';
import { AvatarStatusRing } from '../../components/bizlink/AvatarStatusRing';
import { SyncStatusChip } from '../../components/sync/SyncStatusChip';
import { SyncCenterSheet } from '../../components/sync/SyncCenterSheet';
import { useSession } from '../../lib/session-store';
import { firstName, initialsFromName } from '../../lib/display-name';
import { RSR_DAILY_VISIT_QUOTA, type Client, type Meeting } from '../../types';

// F-012 (RSR only): today's in-person visits vs the daily quota. Online
// meetings never count (ADR-012); fast-path visits do (they are in-person by
// definition, ADR-015).
function countTodayInPersonVisits(meetings: Meeting[]): number {
  const today = new Date();
  return meetings.filter((m) => {
    if (m.meeting_mode === 'online') return false;
    const d = new Date(m.logged_at);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }).length;
}

function RsrQuotaWidget({ meetings }: { meetings: Meeting[] }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const visits = countTodayInPersonVisits(meetings);
  const pct = Math.min(100, Math.round((visits / RSR_DAILY_VISIT_QUOTA) * 100));
  return (
    <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18} marginTop={16}>
      <XStack justifyContent="space-between" alignItems="center" marginBottom={8}>
        <XStack alignItems="center" gap="$1.5">
          <Target size={14} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Daily visit quota (RSR)</Text>
        </XStack>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
          {visits} / {RSR_DAILY_VISIT_QUOTA}
        </Text>
      </XStack>
      <View height={8} borderRadius={99} backgroundColor={BIZLINK_COLORS.soft} overflow="hidden">
        <View height="100%" borderRadius={99} backgroundColor={BIZLINK_COLORS.brand} width={`${pct}%`} />
      </View>
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={8}>
        Minimum {RSR_DAILY_VISIT_QUOTA} clients/day — binibilang ang in-person visits na naitala ngayong araw.
      </Text>
    </YStack>
  );
}

function ClientPreviewRow({ client, waitingManagerApproval }: { client: Client; waitingManagerApproval: boolean }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const badge = CLIENT_STATUS_BADGES[getClientStatus(client)];
  return (
    <Pressable onPress={() => router.push(`/(tabs)/clients/${client.id}`)}>
      <XStack
        alignItems="center"
        gap="$3"
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={14}
        marginBottom={10}
        flexWrap="wrap"
      >
        <YStack flex={1} gap="$0.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.company_name}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {client.contact_person || 'Walang contact person pa'}
          </Text>
        </YStack>
        <YStack alignItems="flex-end" gap="$1">
          <StatusBadge {...badge} />
          {/* F-204: overlay badge, NOT a replacement for the status pill above. */}
          {waitingManagerApproval ? (
            <StatusBadge
              label={WAITING_MANAGER_APPROVAL_BADGE.label}
              background={BIZLINK_COLORS[WAITING_MANAGER_APPROVAL_BADGE.background]}
              color={BIZLINK_COLORS[WAITING_MANAGER_APPROVAL_BADGE.color]}
            />
          ) : null}
        </YStack>
        <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
      </XStack>
    </Pressable>
  );
}

function AgentHomeHeader({ greetingName, isRsr, fullName }: { greetingName: string; isRsr: boolean; fullName: string | null }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
      <Pressable onPress={() => router.push('/(tabs)/more/account')} hitSlop={4}>
        <AvatarStatusRing>
          <Avatar initials={initialsFromName(fullName)} background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
        </AvatarStatusRing>
      </Pressable>
      <YStack gap="$1">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15.5} color={BIZLINK_COLORS.text}>
          {greetingName ? `Kamusta, ${greetingName}!` : 'Kamusta!'}
        </Text>
        <StatusBadge label={isRsr ? 'RSR' : 'Sales Specialist'} background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
      </YStack>
      <Pressable onPress={() => router.push('/(tabs)/more/notifications')} style={{ marginLeft: 'auto' }} hitSlop={6}>
        <View
          width={44}
          height={44}
          borderRadius={22}
          backgroundColor={BIZLINK_COLORS.card}
          alignItems="center"
          justifyContent="center"
        >
          <Bell size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
        </View>
      </Pressable>
    </XStack>
  );
}

export default function AgentHomeScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { clients, refresh: refreshClients } = useClients();
  const { meetings, refresh: refreshMeetings } = useMeetings();
  const { role, fullName, profileId } = useSession();
  const isRsr = role === 'rsr';
  const greetingName = firstName(fullName);
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  // B-023: remounts the chip on sheet-close so a "Retry All" inside the
  // sheet is reflected immediately — the chip's own useFocusEffect never
  // re-fires here since the Modal never actually blurs this screen.
  const [syncChipKey, setSyncChipKey] = useState(0);
  // F-204: bulk-loaded once per focus (not per-row) — same N+1 avoidance
  // pattern as meetings/index.tsx's getMyCompanionRequests bulk-load.
  const [waitingManagerApprovalIds, setWaitingManagerApprovalIds] = useState<Set<string>>(new Set());

  // Bug fix: Home was only fetching clients/meetings once on mount (its
  // hooks' own useEffect), unlike clients/index.tsx and meetings/index.tsx
  // which both re-fetch via useFocusEffect — so stat cards froze at whatever
  // was loaded the first time Home mounted (often all-zero, before any data
  // existed) and never reflected data added elsewhere in the session.
  useFocusEffect(
    useCallback(() => {
      refreshClients();
      refreshMeetings();
    }, [refreshClients, refreshMeetings])
  );

  useFocusEffect(
    useCallback(() => {
      if (!profileId) return;
      getClientIdsWithPendingManagerTagAlong(profileId)
        .then(setWaitingManagerApprovalIds)
        .catch((err) => console.error('[Home] pending manager tag-along lookup failed:', err instanceof Error ? err.message : String(err)));
    }, [profileId])
  );

  const prospects = clients.filter((c) => getClientStatus(c) === 'prospect');
  const nonProspects = clients.filter((c) => getClientStatus(c) !== 'prospect');
  // F-204: intersected with `prospects`, not the raw Set size — the Set can
  // include non-prospect clients once Migration 023 lands (a `new`-status
  // client with a still-pending tag-along), so this keeps the "n prospects
  // waiting" copy accurate rather than relying on today's select-client.tsx
  // invariant that only prospects can start a tag-along.
  const waitingManagerApprovalProspects = prospects.filter((c) => waitingManagerApprovalIds.has(c.id));
  const now = new Date();
  // B-063: real "this week" delta (same countCreatedSince helper used by
  // lib/manager-team-service.ts's newProspectsThisWeek) instead of a
  // hardcoded "+1 this week" literal. Omit the caption entirely when there's
  // nothing meaningful to show, rather than displaying "+0 this week".
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newProspectsThisWeek = countCreatedSince(prospects, weekAgo);
  const thisMonth = meetings.filter((m) => {
    const d = new Date(m.logged_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const successful = thisMonth.filter((m) => m.outcome === 'Successful');

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <AgentHomeHeader greetingName={greetingName} isRsr={isRsr} fullName={fullName} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        <XStack gap={10} marginTop={6}>
          <YStack flex={1}>
            <BizStatCard
              tone="tintA"
              value={prospects.length}
              label="Prospects ko"
              caption={newProspectsThisWeek > 0 ? `+${newProspectsThisWeek} this week` : undefined}
              onPress={() => router.push('/(tabs)/clients')}
            />
          </YStack>
          <YStack flex={1}>
            <BizStatCard
              tone="white"
              value={nonProspects.length}
              label="Clients ko"
              caption="new + existing"
              onPress={() => router.push('/(tabs)/clients')}
            />
          </YStack>
        </XStack>

        <BizHeroCard
          value={thisMonth.length}
          unit="meetings"
          label="This month"
          caption={`${successful.length} successful`}
          onPress={() => router.push('/(tabs)/meetings')}
        />

        {/* Quick Actions directly under the hero card (Wireframe-Sales-BizLink.html a-home, 2026-07-14 client feedback). */}
        <BizSectionHeader title="Quick Actions" />
        <XStack gap="$2.5" flexWrap="wrap">
          <BizQuickAction icon={<Plus size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Create Client" onPress={() => router.push('/(tabs)/clients/create')} />
          <BizQuickAction icon={<Camera size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Record Meeting" onPress={() => router.push('/(tabs)/meetings/select-client')} />
          <BizQuickAction icon={<ClipboardList size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Clients" onPress={() => router.push('/(tabs)/clients')} />
          <BizQuickAction icon={<Users size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Tag-Along" onPress={() => router.push('/(tabs)/more/tag-along')} />
        </XStack>

        {isRsr ? <RsrQuotaWidget meetings={meetings} /> : null}

        {/* T-014 Phase 1 (ADR-024): shared, BizLink-styled — same worst-state-wins logic/copy as before. */}
        <SyncStatusChip key={syncChipKey} onPress={() => setSyncSheetOpen(true)} />

        {prospects.length > 0 ? (
          <BizDashboardAlert
            tone="red"
            icon={<Hourglass size={18} color={BIZLINK_COLORS.red} strokeWidth={1.75} />}
            title={`${prospects.length} prospect${prospects.length > 1 ? 's' : ''} na kailangan kumpletuhin`}
            caption="1-month rule — kumpletuhin o auto-delete"
            onPress={() => router.push('/(tabs)/clients')}
          />
        ) : null}

        {/* F-204: overlay indicator, directly under the prospects-need-completing
            banner above (per F-204's placement requirement) — a separate row
            rather than folding into the red banner, since this is a distinct
            condition (pending manager tag-along, not the 1-month deadline). */}
        {waitingManagerApprovalProspects.length > 0 ? (
          <BizDashboardAlert
            tone="amber"
            icon={<Hourglass size={18} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />}
            title={`${waitingManagerApprovalProspects.length} prospect${waitingManagerApprovalProspects.length > 1 ? 's' : ''} waiting for manager approval`}
            caption="Hinihintay ang sagot ng manager sa tag-along bago mag-progress"
            onPress={() => router.push('/(tabs)/clients')}
          />
        ) : null}

        <BizSectionHeader
          title="Mga Client Ko"
          actionLabel="Tingnan lahat"
          onAction={() => router.push('/(tabs)/clients')}
        />
        {clients.slice(0, 3).map((client) => (
          <ClientPreviewRow
            key={client.id}
            client={client}
            waitingManagerApproval={waitingManagerApprovalIds.has(client.id)}
          />
        ))}
        {clients.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">
            Wala ka pang clients — magsimula sa Create Client.
          </Text>
        ) : null}
      </ScrollView>

      <SyncCenterSheet
        visible={syncSheetOpen}
        onClose={() => {
          setSyncSheetOpen(false);
          setSyncChipKey((k) => k + 1);
        }}
      />
    </YStack>
  );
}
