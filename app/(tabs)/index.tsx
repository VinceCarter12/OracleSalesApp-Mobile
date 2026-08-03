import { useCallback, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Handshake,
  History,
  Hourglass,
  Map as MapIcon,
  Plus,
  RotateCcw,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { useClients } from '../../lib/useClients';
import { useMeetings } from '../../lib/useMeetings';
import { getClientStatus } from '../../lib/client-status';
import { getClientIdsWithPendingManagerTagAlong } from '../../lib/tag-along-service';
import { countCreatedSince } from '../../lib/team-remote-mappers';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizStatCard } from '../../components/bizlink/BizStatCard';
import { BizHeroCard } from '../../components/bizlink/BizHeroCard';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizDashboardAlert } from '../../components/bizlink/BizDashboardAlert';
import { BizPrimaryActionCard } from '../../components/bizlink/BizPrimaryActionCard';
import { BizQuickAction } from '../../components/bizlink/BizQuickAction';
import { AvatarStatusRing } from '../../components/bizlink/AvatarStatusRing';
import { SyncStatusChip } from '../../components/sync/SyncStatusChip';
import { SyncCenterSheet } from '../../components/sync/SyncCenterSheet';
import { useSession } from '../../lib/session-store';
import { firstName, initialsFromName } from '../../lib/display-name';
import { CutoffQuotaCard } from '../../components/cutoff/CutoffQuotaCard';
import { useCutoffQuotaFlag } from '../../lib/use-cutoff-quota-flag';
import { getDashboardActionHref } from '../../lib/dashboard-action-registry';
import { RSR_DAILY_VISIT_QUOTA, type Meeting } from '../../types';

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
  // Batch 7C (ADR-053, W-1): when the flag is ON, the shared cutoff/quota
  // card replaces the RSR-only legacy widget for BOTH roles; when OFF, the
  // legacy widget renders exactly as before (RSR only) — fully untouched.
  const cutoffQuotaFlagOn = useCutoffQuotaFlag();
  const isCutoffQuotaRole = role === 'sales_specialist' || role === 'rsr';
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
              // ADR-042: `nonProspects` is everything !== 'prospect', which
              // now also includes 'in_progress' — caption updated so it
              // stays accurate rather than silently going stale.
              caption="in progress + new + existing"
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

        {/* Wireframe-Sales-BizLink.html#a-home "Mga Gawain" — two dominant
            wide action cards (2026-08-03 visual-parity redesign, replaces
            the previous 4-equal-circle Quick Actions row). */}
        <BizSectionHeader title="Mga Gawain" />
        <XStack gap="$2.5">
          <BizPrimaryActionCard
            variant="dark"
            icon={<Plus size={18} color="#FFFFFF" strokeWidth={1.75} />}
            title="Gumawa ng client"
            subtitle="Company at city muna"
            onPress={() => router.push(getDashboardActionHref('create-client', role))}
          />
          <BizPrimaryActionCard
            variant="alt"
            icon={<Handshake size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="I-record ang meeting"
            subtitle="Pumili muna ng client"
            onPress={() => router.push(getDashboardActionHref('record-meeting', role))}
          />
        </XStack>

        {/* Wireframe "Iba pang gawain" — full secondary action hub, 3-column
            grid, previously hidden behind the More tab. Every tile keeps its
            existing real destination/route. */}
        <BizSectionHeader title="Iba pang gawain" />
        {/* Wireframe `.qa` is an explicit 3-column grid (grid-template-columns:
            repeat(3,1fr)), not natural flex-wrap — rowed manually so wider
            screens don't silently reflow to 4-per-row and drift from the
            wireframe's fixed column count. */}
        <YStack gap="$3">
          <XStack justifyContent="space-between">
            <BizQuickAction icon={<Building2 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Clients" onPress={() => router.push(getDashboardActionHref('my-clients', role))} />
            <BizQuickAction icon={<CalendarDays size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Meeting Details" onPress={() => router.push('/(tabs)/meetings')} />
            <BizQuickAction icon={<Bell size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Notifications" onPress={() => router.push('/(tabs)/more/notifications')} />
          </XStack>
          <XStack justifyContent="space-between">
            <BizQuickAction icon={<Clock size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Clock In/Out" onPress={() => router.push('/(tabs)/more/clock-in-out')} />
            <BizQuickAction icon={<Users size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Tag-Along Status" onPress={() => router.push(getDashboardActionHref('tag-along', role))} />
            <BizQuickAction icon={<ClipboardCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Requests" onPress={() => router.push('/(tabs)/more/my-requests')} />
          </XStack>
          <XStack justifyContent="space-between">
            <BizQuickAction icon={<History size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Sync History" onPress={() => router.push('/(tabs)/more/sync-history')} />
            <BizQuickAction icon={<BarChart3 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Performance" onPress={() => router.push('/(tabs)/more/reports')} />
            <BizQuickAction icon={<RotateCcw size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Lost opportunities" onPress={() => router.push('/(tabs)/more/lost-opportunities')} />
          </XStack>
          <XStack justifyContent="flex-start" gap="$2.5">
            <BizQuickAction icon={<MapIcon size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Maps" onPress={() => router.push('/(tabs)/more/maps')} />
            <BizQuickAction icon={<ShieldCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Account" onPress={() => router.push('/(tabs)/more/account')} />
          </XStack>
        </YStack>

        {cutoffQuotaFlagOn && isCutoffQuotaRole ? (
          <CutoffQuotaCard agentId={profileId} role={role === 'rsr' ? 'rsr' : 'sales_specialist'} />
        ) : isRsr ? (
          <RsrQuotaWidget meetings={meetings} />
        ) : null}

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
