import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Bell, Hourglass } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { useManagerDashboard } from '../../lib/useManagerDashboard';
import { useManagerApprovalFeed } from '../../lib/use-manager-approval-feed';
import { useManagerActionableRequests } from '../../lib/use-manager-actionable-requests';
import { usePendingTagAlongCount } from '../../lib/use-pending-tag-along-count';
import { useSession } from '../../lib/session-store';
import { useManagerScope } from '../../lib/manager-scope-store';
import { useActiveMeetingDrafts } from '../../lib/use-active-meeting-drafts';
import { getLastSyncAt } from '../../lib/sync/last-sync';
import { timeAgo } from '../../lib/time-ago';
import { firstName, initialsFromName } from '../../lib/display-name';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizHeroCard } from '../../components/bizlink/BizHeroCard';
import { BizButton } from '../../components/bizlink/BizButton';
import { BizScopeFilter } from '../../components/bizlink/BizScopeFilter';
import { AvatarStatusRing } from '../../components/bizlink/AvatarStatusRing';
import { SyncStatusChip } from '../../components/sync/SyncStatusChip';
import { SyncCenterSheet } from '../../components/sync/SyncCenterSheet';
import { ManagerHomeActionsSection } from '../../components/manager/ManagerHomeActionsSection';
import { ManagerHomeTeamSection } from '../../components/manager/ManagerHomeTeamSection';
import { ActiveMeetingDashboardAlert } from '../../components/meetings/ActiveMeetingDashboardAlert';
import { CutoffQuotaCard } from '../../components/cutoff/CutoffQuotaCard';
import type { ManagerScope } from '../../lib/manager-scope';

// Wireframe-Manager-BizLink.html renderManagerScope() (~line 1123/1127-1132):
// `meta={mine:{...label:'My'},team:{...label:'Team'},combined:{...label:'Combined'}}`
// — the stat-card labels below change with scope, not just their numbers.
// Guest Records (2026-08-22): no wireframe entry (skip-authorized) — 'Guest'
// follows the same short-caption style as the other three.
const SCOPE_LABEL: Record<ManagerScope, string> = { mine: 'My', team: 'Team', combined: 'Combined', guest: 'Guest' };

// Wireframe-Manager-BizLink.html renderManagerScope() (~line 1147-1149):
// `document.getElementById('managerScopeNote').textContent = managerScope==='mine'
//   ? 'Your local records are available offline.'
//   : (managerScope==='team' ? 'Team snapshot. Last authorized sync: today, 8:12 AM.' : 'Combined view. Team data is the last authorized sync when offline.');`
// The 'mine'/'combined' strings are copied verbatim (no data dependency). The
// 'team' string's "today, 8:12 AM" is the wireframe's own canned demo value —
// per `.claude/rules/50-wireframe-redesign.md` ("never copy mock data into
// the app"), this is re-implemented with this device's real
// `getLastSyncAt()` (same source `SyncStatusChip` already renders below) in
// place of the fabricated clock reading, keeping the wireframe's exact
// sentence structure.
function scopeHelperNote(scope: ManagerScope, lastSyncAt: string | null): string {
  if (scope === 'mine') return 'Your local records are available offline.';
  if (scope === 'team') {
    const syncLabel = lastSyncAt ? timeAgo(lastSyncAt) : 'never synced yet';
    return `Team snapshot. Last authorized sync: ${syncLabel}.`;
  }
  // Guest Records (2026-08-22): held clients from other teams — always a
  // live Supabase read (`lib/manager-held-clients.ts`), same online-only
  // caveat as "My Team".
  if (scope === 'guest') return 'Held clients from other teams. Requires an internet connection.';
  return 'Combined view. Team data is the last authorized sync when offline.';
}

// T-014 Phase 3 (ADR-024): local, Manager-Home-only replacements for
// `components/manager/TeamAvatarStrip.tsx` / `TeamMeetingRow.tsx` — those two
// shared files are still consumed by `app/(executive)/index.tsx` (Phase 4,
// not yet migrated), so they're left on the old `COLORS` palette rather than
// touched in place (same "bypass the shared shell" precedent Phase 2 used
// for `components/account/AccountScreen.tsx`).

/** Wireframe s-home — real cross-agent Supabase data (ADR-021); manager's own-device sync chip (ADR-022 Phase D scope, not team-wide). */
export default function ManagerDashboardScreen() {
  const insets = useSafeAreaInsets();
  // B-073 (ADR-052 §G): both hooks now share the same 'mine'|'team'|'combined'
  // scope selection, closing the divergence between this screen's aggregates
  // and Team Overview's.
  const { scope } = useManagerScope();
  const { summary, error, refresh: refreshDashboard } = useManagerDashboard(scope);
  const { fullName, profileId, role } = useSession();
  // Wireframe s-home "Mga Gawain" primary-action hub (item 1): same
  // cross-screen active-meeting visibility Sales Home uses for its
  // "I-record ang meeting" card — a Manager can also record their own
  // meetings (app/(manager)/clients/record.tsx, F-205 reuse of the Sales
  // screens), so `meeting_drafts` rows keyed by the manager's own profileId
  // apply the same way.
  const { activeMeetingDrafts } = useActiveMeetingDrafts(profileId);
  // Pull-to-refresh spinner must be bound to a user-gesture-only flag, not
  // either hook's own `loading`/`overviewLoading` (both also flip on
  // mount/refocus, since each hook independently re-fetches on
  // useFocusEffect) — see app/(tabs)/index.tsx's twin.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  // B-023: see app/(tabs)/index.tsx's twin — remounts the chip on sheet-close.
  const [syncChipKey, setSyncChipKey] = useState(0);
  // Wireframe s-home managerScopeNote 'team' variant (item 3) — this
  // device's own real last-sync timestamp, same source SyncStatusChip uses.
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  // F-205: the "Pending approvals" stat card is retired along with the
  // Approvals screen — replaced by a real count of pending tag-along
  // requests needing this manager's accept/reject (the one remaining
  // "needs my action" queue for a manager, B-053's real invitee-side data).
  // 2026-08-16 bugfix: extracted into `usePendingTagAlongCount` — see that
  // file's doc comment — so it refreshes on sync-complete, not just focus.
  const { count: pendingTagAlongCount } = usePendingTagAlongCount(profileId);

  // Manager Approvals badge (2026-08-04 Full Badge Implementation)
  const { rows: approvalRows } = useManagerApprovalFeed();
  const pendingApprovalCount = useMemo(
    () => approvalRows.filter((r) => r.status === 'pending').length,
    [approvalRows]
  );

  // 2026-08-16 (requirement C): the bell badge reflects real *unread*
  // pending client_edit/po_confirmation/tag_along — not merely "is anything
  // pending" — refreshed on focus and after every foreground sync
  // (`use-manager-actionable-requests.ts`'s own `subscribeSyncComplete`).
  // Originally kept as a plain dot per Wireframe-Manager-BizLink.html's
  // `#bellDot` (no digit variant) — Vince explicitly overrode that
  // wireframe-parity reasoning later the same day and asked for a real
  // number, so the badge below now reuses `BizQuickAction`'s exact numeric
  // badge styling (`components/bizlink/BizQuickAction.tsx` lines 35-52)
  // instead of the dot.
  const { unreadPendingItems } = useManagerActionableRequests(profileId);
  const unreadRequestCount = unreadPendingItems.length;

  useFocusEffect(
    useCallback(() => {
      getLastSyncAt()
        .then(setLastSyncAt)
        .catch((err) => console.error('[ManagerHome] last-sync-at lookup failed:', err instanceof Error ? err.message : String(err)));
    }, [])
  );

  // Only show the full-screen spinner on the true initial load (no data
  // yet) — a pull-to-refresh also sets `loading` true, and that must show
  // the RefreshControl's own spinner over existing content, not blank the
  // whole screen.
  if (!summary) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas} gap="$3" paddingHorizontal="$5">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
        <BizButton small label="Try again" variant="white" onPress={refreshDashboard} />
      </YStack>
    );
  }

  const initials = initialsFromName(fullName);
  const greetingName = firstName(fullName) || summary.managerName;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Pressable onPress={() => router.push('/(manager)/more/account')} hitSlop={4}>
          <AvatarStatusRing>
            <Avatar initials={initials} background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
          </AvatarStatusRing>
        </Pressable>
        <YStack gap="$1">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15.5} color={BIZLINK_COLORS.text}>
            Good morning, {greetingName}!
          </Text>
          {/* ADR-017: a single `sales_manager` role — never a separate "RSR Manager" title. */}
          <StatusBadge label="Sales Manager" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
        </YStack>
        <Pressable onPress={() => router.push('/(manager)/more/notifications')} style={{ marginLeft: 'auto' }} hitSlop={6}>
          <YStack width={44} height={44} borderRadius={22} backgroundColor={BIZLINK_COLORS.card} alignItems="center" justifyContent="center" position="relative">
            <Bell size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            {unreadRequestCount > 0 ? (
              <YStack
                position="absolute"
                top={-4}
                right={-4}
                backgroundColor={BIZLINK_COLORS.red}
                borderRadius={999}
                paddingHorizontal={5}
                minWidth={16}
                height={16}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={9.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>
                  {unreadRequestCount}
                </Text>
              </YStack>
            ) : null}
          </YStack>
        </Pressable>
      </XStack>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              setIsRefreshing(true);
              try {
                await refreshDashboard();
              } finally {
                setIsRefreshing(false);
              }
            }}
          />
        }
      >
        <BizScopeFilter />
        {/* Wireframe-Manager-BizLink.html s-home #managerScopeNote — see
            scopeHelperNote()'s doc comment above for the 'team' real-data
            substitution. */}
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={2} marginBottom={10}>
          {scopeHelperNote(scope, lastSyncAt)}
        </Text>

        <BizHeroCard
          value={summary.teamMeetings}
          unit="meetings"
          label={`${SCOPE_LABEL[scope]} meetings this month`}
          caption={`${summary.teamMeetingsSuccessful} successful`}
          onPress={() => router.push('/(manager)/more/meetings')}
        />

        {/* A manager's OWN monthly quota, new in web migration 105 (2026-08-16):
            before it, they were measured against whatever their team's target
            was and so had no personal number to show. Placed directly under the
            hero card, matching where the Sales/RSR home puts it — and note the
            two answer different questions: the hero above is the TEAM's meetings
            this month, this is the manager's own 20, which their tag-alongs
            count toward. Rendered only for `sales_manager`; this route group is
            manager-only, but `role` is nullable while the session loads and the
            card's prop is a CutoffQuotaRole, so the check is real, not
            decorative. */}
        {role === 'sales_manager' ? (
          <CutoffQuotaCard agentId={profileId} role="sales_manager" />
        ) : null}

        {/* Wireframe-Manager-BizLink.html s-home "Mga Gawain" + "Manager
            Actions" (line 477-498) — extracted, see
            ManagerHomeActionsSection's own doc comment. */}
        <ManagerHomeActionsSection
          role={role}
          activeMeeting={activeMeetingDrafts.length > 0}
          pendingApprovalCount={pendingApprovalCount}
          pendingTagAlongCount={pendingTagAlongCount}
        />

        {/* T-014 Phase 3 (ADR-022 Phase D scope): manager's OWN device outbox
            only — same SyncStatusChip/SyncCenterSheet as the Sales Agent Home,
            never team-wide (device_sync_status heartbeat is Phase E, not
            committed). The old mock "records pending sync" banner
            (`summary.pendingSyncRecords`, always 0 per ADR-021) is replaced by
            this real per-device chip. */}
        <SyncStatusChip key={syncChipKey} onPress={() => setSyncSheetOpen(true)} />

        {/* Topmost — reused as-is from Sales Home; a Manager also records
            their own meetings (F-205 reuse of record.tsx), full-form only. */}
        <ActiveMeetingDashboardAlert activeMeetingDrafts={activeMeetingDrafts} />

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
                {summary.deadlineWarningCount} prospects across the team: info deadline is close
              </Text>
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red}>Client info deadline — complete it or it is auto-deleted</Text>
            </YStack>
          </XStack>
        ) : null}

        <ManagerHomeTeamSection agents={summary.agents} />
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
