import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, useWindowDimensions } from 'react-native';
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
} from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { useClients } from '../../lib/useClients';
import { useMeetings } from '../../lib/useMeetings';
import { getClientStatus } from '../../lib/client-status';
import { getClientIdsWithPendingManagerTagAlong } from '../../lib/tag-along-service';
import { useActiveMeetingDrafts } from '../../lib/use-active-meeting-drafts';
import { useMyRequestStatuses } from '../../lib/use-my-request-statuses';
import { useUnreadNotificationCount } from '../../lib/use-unread-notification-count';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizHeroCard } from '../../components/bizlink/BizHeroCard';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizDashboardAlert } from '../../components/bizlink/BizDashboardAlert';
import { BizPrimaryActionCard } from '../../components/bizlink/BizPrimaryActionCard';
import { BizQuickAction } from '../../components/bizlink/BizQuickAction';
import { BizQuickActionGrid, computeQuickActionColumns } from '../../components/bizlink/BizQuickActionGrid';
import { AvatarStatusRing } from '../../components/bizlink/AvatarStatusRing';
import { ActiveMeetingDashboardAlert } from '../../components/meetings/ActiveMeetingDashboardAlert';
import { SyncStatusChip } from '../../components/sync/SyncStatusChip';
import { SyncCenterSheet } from '../../components/sync/SyncCenterSheet';
import { useSession } from '../../lib/session-store';
import { firstName, initialsFromName } from '../../lib/display-name';
import { CutoffQuotaCard } from '../../components/cutoff/CutoffQuotaCard';
import type { CutoffQuotaRole } from '../../lib/policies/cutoff-policy';
import { getDashboardActionHref } from '../../lib/dashboard-action-registry';

function AgentHomeHeader({ greetingName, isRsr, fullName, notificationCount }: { greetingName: string; isRsr: boolean; fullName: string | null; notificationCount: number }) {
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
          position="relative"
        >
          <Bell size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
          {notificationCount > 0 ? (
            <View position="absolute" top={9} right={10} width={8} height={8} borderRadius={4} backgroundColor={BIZLINK_COLORS.red} />
          ) : null}
        </View>
      </Pressable>
    </XStack>
  );
}

// BizQuickAction tile is a fixed 78dp column; wireframe `.qa` is
// `grid-template-columns: repeat(3,1fr)` on a phone-width viewport, but a
// fixed 3-per-row with a fixed 8dp gap leaves dead space on a wider screen
// instead of reflowing — this computes the real column count from available
// width so tablets/landscape/wider devices grow to 4+ columns automatically
// (2026-08-03 responsive-grid fix).
export default function AgentHomeScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const quickActionColumns = computeQuickActionColumns(windowWidth, 16);
  const { clients, refresh: refreshClients } = useClients();
  const { meetings, refresh: refreshMeetings } = useMeetings();
  // Pull-to-refresh spinner must be bound to a user-gesture-only flag, not
  // the hooks' own `loading` (which also flips on mount/refocus/background
  // sync completion and would pop the spinner uncommanded).
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { role, fullName, profileId } = useSession();
  const { activeMeetingDrafts } = useActiveMeetingDrafts(profileId);
  const isRsr = role === 'rsr';
  // 2026-08-03 (Vince direction): the CutoffQuotaCard section always renders
  // for a quota-carrying role now, regardless of the `cutoff_quota_v1` flag —
  // the flag still gates the separate background sync-down
  // (lib/sync/cutoff-sync-down.ts), not this local-read display.
  // CutoffQuotaCard itself queries the local SQLite snapshot directly and
  // renders the honest "No quota configured" state when nothing has synced yet
  // — never a hardcoded fallback. Collection and Delivery never see this card.
  //
  // Managers DO see it as of 2026-08-16 (web migration 105): they carry a flat
  // monthly target of their own now, where before they were measured against
  // their team's number and had nothing personal to show. Narrowed to a real
  // CutoffQuotaRole rather than coerced — the old `role === 'rsr' ? 'rsr' :
  // 'sales_specialist'` would have labelled a manager a sales specialist.
  const quotaRole: CutoffQuotaRole | null =
    role === 'sales_specialist' || role === 'rsr' || role === 'sales_manager' ? role : null;
  const greetingName = firstName(fullName);
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  // B-023: remounts the chip on sheet-close so a "Retry All" inside the
  // sheet is reflected immediately — the chip's own useFocusEffect never
  // re-fires here since the Modal never actually blurs this screen.
  const [syncChipKey, setSyncChipKey] = useState(0);
  // F-204: bulk-loaded once per focus (not per-row) — same N+1 avoidance
  // pattern as meetings/index.tsx's getMyCompanionRequests bulk-load.
  const [waitingManagerApprovalIds, setWaitingManagerApprovalIds] = useState<Set<string>>(new Set());

  // Notification badge counts (2026-08-04 Full Badge Implementation)
  const { rows: myRequestRows } = useMyRequestStatuses();

  // Badge count calculations. Notifications-Page-Handoff-2026-08-08 Task 1:
  // the dashboard bell + More-tile "Notifications" badge now reflect the
  // real unread-notification count (lib/notification-unread.ts), not the
  // raw outbox counts this used to be. The separate `SyncStatusChip` below
  // still self-fetches `getOutboxCounts()` on its own focus effect (it's
  // called here with no `counts` prop) — same source, no drift, per this
  // handoff's "sync counts must stay consistent with the Home screen chip"
  // rule. The dedicated `useSync(profileId, null)` call this replaced was
  // otherwise unused here (root-level scheduling already runs once via
  // `app/_layout.tsx`'s own `useSync` call) — removed rather than left as
  // a second redundant scheduler instance.
  const notificationBadgeCount = useUnreadNotificationCount(profileId);
  const myRequestsBadgeCount = useMemo(
    () => myRequestRows.filter((r) => r.status === 'pending').length,
    [myRequestRows]
  );

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
  // F-204: intersected with `prospects`, not the raw Set size — the Set can
  // include non-prospect clients once Migration 023 lands (a `new`-status
  // client with a still-pending tag-along), so this keeps the "n prospects
  // waiting" copy accurate rather than relying on today's select-client.tsx
  // invariant that only prospects can start a tag-along.
  const waitingManagerApprovalProspects = prospects.filter((c) => waitingManagerApprovalIds.has(c.id));
  const now = new Date();
  const thisMonth = meetings.filter((m) => {
    const d = new Date(m.logged_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const successful = thisMonth.filter((m) => m.outcome === 'Successful');

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <AgentHomeHeader greetingName={greetingName} isRsr={isRsr} fullName={fullName} notificationCount={notificationBadgeCount} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              setIsRefreshing(true);
              try {
                await Promise.all([refreshClients(), refreshMeetings()]);
              } finally {
                setIsRefreshing(false);
              }
            }}
          />
        }
      >
        <BizHeroCard
          value={thisMonth.length}
          unit="meetings"
          label="This month"
          caption={`${successful.length} successful`}
          onPress={() => router.push('/(tabs)/meetings')}
        />

{/* 2026-08-09 (Vince direction): the "Prospects ko / Clients ko" stat
            grid was REMOVED from Home — My Performance (`/(tabs)/more/reports`)
            and the Clients tab already surface those counts, and the grid's
            caption math (`countCreatedSince`/`nonProspects`) was only consumed
            there. Home now opens directly with the This-month meeting card. */}

        {/* 2026-08-09 (Vince direction): the cutoff quota card sits directly
            under the This-month meeting card, above the action sections. */}
        {quotaRole ? <CutoffQuotaCard agentId={profileId} role={quotaRole} /> : null}

        {/* Wireframe-Sales-BizLink.html#a-home "Mga Gawain" — two dominant
            wide action cards (2026-08-03 visual-parity redesign, replaces
            the previous 4-equal-circle Quick Actions row). */}
        <BizSectionHeader title="Your tasks" />
        <XStack gap="$2.5">
          <BizPrimaryActionCard
            variant="dark"
            icon={<Plus size={18} color="#FFFFFF" strokeWidth={1.75} />}
            title="Create a client"
            subtitle="Company and city first"
            onPress={() => router.push(getDashboardActionHref('create-client', role))}
          />
          <BizPrimaryActionCard
            variant="alt"
            icon={<Handshake size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Record a meeting"
            subtitle="Pick a client first"
            onPress={() => router.push(getDashboardActionHref('record-meeting', role))}
            active={activeMeetingDrafts.length > 0}
          />
        </XStack>

        {/* Wireframe "Iba pang gawain" — full secondary action hub, 3-column
            grid on phone width, previously hidden behind the More tab. Every
            tile keeps its existing real destination/route. */}
        <BizSectionHeader title="More tools" />
        {/* Wireframe `.qa` is `grid-template-columns: repeat(3,1fr)` at phone
            width, 16dp row gap / 8dp column gap — but a real CSS grid
            reflows to more columns as the viewport grows. Rowed manually
            (not flexWrap+space-between) using `quickActionColumns` so wider
            screens grow past 3 instead of leaving dead space. Complete rows
            spread across the width; a partial final row stays grouped from
            the left. */}
        <BizQuickActionGrid
          columns={quickActionColumns}
          actions={[
            <BizQuickAction key="my-clients" icon={<Building2 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Clients" onPress={() => router.push(getDashboardActionHref('my-clients', role))} />,
            <BizQuickAction key="meeting-details" icon={<CalendarDays size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Meeting Details" onPress={() => router.push('/(tabs)/meetings')} />,
            <BizQuickAction key="notifications" icon={<Bell size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Notifications" badgeCount={notificationBadgeCount} onPress={() => router.push('/(tabs)/more/notifications')} />,
            <BizQuickAction key="clock-in-out" icon={<Clock size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Clock In/Out" onPress={() => router.push('/(tabs)/more/clock-in-out')} />,
            <BizQuickAction key="my-requests" icon={<ClipboardCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Requests" badgeCount={myRequestsBadgeCount} onPress={() => router.push('/(tabs)/more/my-requests')} />,
            <BizQuickAction key="sync-history" icon={<History size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Sync History" onPress={() => router.push('/(tabs)/more/sync-history')} />,
            <BizQuickAction key="performance" icon={<BarChart3 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Performance" onPress={() => router.push('/(tabs)/more/reports')} />,
            <BizQuickAction key="lost-opportunities" icon={<RotateCcw size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Lost opportunities" onPress={() => router.push('/(tabs)/more/lost-opportunities')} />,
            <BizQuickAction key="maps" icon={<MapIcon size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Maps" onPress={() => router.push('/(tabs)/more/maps')} />,
            <BizQuickAction key="account" icon={<ShieldCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Account" onPress={() => router.push('/(tabs)/more/account')} />,
          ]}
        />

        {/* T-014 Phase 1 (ADR-024): shared, BizLink-styled — same worst-state-wins logic/copy as before.
            2026-08-09 (Vince direction): sits below "Iba pang gawain", above the alert banners. */}
        <SyncStatusChip key={syncChipKey} onPress={() => setSyncSheetOpen(true)} />

        {/* Topmost — most time-sensitive item; see component's doc comment. */}
        <ActiveMeetingDashboardAlert activeMeetingDrafts={activeMeetingDrafts} />

        {prospects.length > 0 ? (
          <BizDashboardAlert
            tone="red"
            icon={<Hourglass size={18} color={BIZLINK_COLORS.red} strokeWidth={1.75} />}
            title={`${prospects.length} possible client${prospects.length > 1 ? 's' : ''} still need their information completed`}
            caption="They have 1 month from being created — complete it or the record is auto-removed"
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
            caption="Waiting for your manager to accept the visit invite before this client can move forward"
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
