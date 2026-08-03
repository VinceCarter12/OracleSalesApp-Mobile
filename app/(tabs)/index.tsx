import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, useWindowDimensions } from 'react-native';
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
import { getDashboardActionHref } from '../../lib/dashboard-action-registry';

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

// BizQuickAction tile is a fixed 78dp column; wireframe `.qa` is
// `grid-template-columns: repeat(3,1fr)` on a phone-width viewport, but a
// fixed 3-per-row with a fixed 8dp gap leaves dead space on a wider screen
// instead of reflowing — this computes the real column count from available
// width so tablets/landscape/wider devices grow to 4+ columns automatically
// (2026-08-03 responsive-grid fix).
const QUICK_ACTION_COLUMN_WIDTH = 78;
const QUICK_ACTION_GAP = 8;
function computeQuickActionColumns(screenWidth: number, horizontalPadding: number): number {
  const available = screenWidth - horizontalPadding * 2;
  const columns = Math.floor((available + QUICK_ACTION_GAP) / (QUICK_ACTION_COLUMN_WIDTH + QUICK_ACTION_GAP));
  return Math.max(3, columns);
}

export default function AgentHomeScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const quickActionColumns = computeQuickActionColumns(windowWidth, 16);
  const { clients, refresh: refreshClients } = useClients();
  const { meetings, refresh: refreshMeetings } = useMeetings();
  const { role, fullName, profileId } = useSession();
  const isRsr = role === 'rsr';
  // 2026-08-03 (Vince direction): the CutoffQuotaCard section always renders
  // for Sales/RSR now, regardless of the `cutoff_quota_v1` flag — the flag
  // still gates the separate background sync-down (lib/sync/cutoff-sync-down.ts),
  // not this local-read display. CutoffQuotaCard itself queries the local
  // SQLite snapshot directly and renders the honest "No quota configured"
  // state when nothing has synced yet — never a hardcoded fallback. Manager,
  // Collection, and Delivery never see this card.
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

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 + insets.bottom }}>
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
            grid on phone width, previously hidden behind the More tab. Every
            tile keeps its existing real destination/route. */}
        <BizSectionHeader title="Iba pang gawain" />
        {/* Wireframe `.qa` is `grid-template-columns: repeat(3,1fr)` at phone
            width, 16dp row gap / 8dp column gap — but a real CSS grid
            reflows to more columns as the viewport grows. Rowed manually
            (not flexWrap+space-between) using `quickActionColumns` so wider
            screens grow past 3 instead of leaving dead space, and a partial
            last row still aligns to column 1 instead of spreading edge to
            edge (2026-08-03 responsive-grid fix). */}
        <YStack gap={16}>
          {(() => {
            const tiles: ReactNode[] = [
              <BizQuickAction key="my-clients" icon={<Building2 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Clients" onPress={() => router.push(getDashboardActionHref('my-clients', role))} />,
              <BizQuickAction key="meeting-details" icon={<CalendarDays size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Meeting Details" onPress={() => router.push('/(tabs)/meetings')} />,
              <BizQuickAction key="notifications" icon={<Bell size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Notifications" onPress={() => router.push('/(tabs)/more/notifications')} />,
              <BizQuickAction key="clock-in-out" icon={<Clock size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Clock In/Out" onPress={() => router.push('/(tabs)/more/clock-in-out')} />,
              <BizQuickAction key="tag-along" icon={<Users size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Tag-Along Status" onPress={() => router.push(getDashboardActionHref('tag-along', role))} />,
              <BizQuickAction key="my-requests" icon={<ClipboardCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Requests" onPress={() => router.push('/(tabs)/more/my-requests')} />,
              <BizQuickAction key="sync-history" icon={<History size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Sync History" onPress={() => router.push('/(tabs)/more/sync-history')} />,
              <BizQuickAction key="performance" icon={<BarChart3 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Performance" onPress={() => router.push('/(tabs)/more/reports')} />,
              <BizQuickAction key="lost-opportunities" icon={<RotateCcw size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Lost opportunities" onPress={() => router.push('/(tabs)/more/lost-opportunities')} />,
              <BizQuickAction key="maps" icon={<MapIcon size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Maps" onPress={() => router.push('/(tabs)/more/maps')} />,
              <BizQuickAction key="account" icon={<ShieldCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Account" onPress={() => router.push('/(tabs)/more/account')} />,
            ];
            const rows: ReactNode[][] = [];
            for (let i = 0; i < tiles.length; i += quickActionColumns) rows.push(tiles.slice(i, i + quickActionColumns));
            return rows.map((row, index) => (
              <XStack key={index} gap={QUICK_ACTION_GAP} justifyContent="flex-start">
                {row}
              </XStack>
            ));
          })()}
        </YStack>

        {isCutoffQuotaRole ? (
          <CutoffQuotaCard agentId={profileId} role={role === 'rsr' ? 'rsr' : 'sales_specialist'} />
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
