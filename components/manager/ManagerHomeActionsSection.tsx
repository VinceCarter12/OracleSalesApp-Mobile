import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import {
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleOff,
  ClipboardCheck,
  Handshake,
  History,
  MapPinned,
  PenLine,
  Plus,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS } from '../../lib/theme';
import { getDashboardActionHref } from '../../lib/dashboard-action-registry';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { BizPrimaryActionCard } from '../bizlink/BizPrimaryActionCard';
import { BizQuickAction } from '../bizlink/BizQuickAction';
import type { UserRole } from '../../types';

interface ManagerHomeActionsSectionProps {
  role: UserRole | null;
  activeMeeting: boolean;
  pendingApprovalCount: number;
  pendingTagAlongCount: number;
  /** Pending count across the manager's OWN outgoing requests — see "My Requests" tile below. */
  myRequestsBadgeCount: number;
}

/**
 * Wireframe-Manager-BizLink.html s-home (line 477-498) — the manager's
 * primary-action hub ("Mga Gawain") plus the full 11-tile "Manager Actions"
 * grid, extracted out of `app/(manager)/index.tsx` to keep that file under
 * the 300-line coding-standard cap. Same `BizPrimaryActionCard`/
 * `BizQuickAction` patterns as the Sales Home twin (`app/(tabs)/index.tsx`).
 *
 * "Meeting Details" reuses the same underlying destination the app
 * previously labeled "Sales History" (both point at
 * `/(manager)/more/meetings`, the wireframe's `openMeetingsList()`) —
 * renamed/re-iconed to match the wireframe, route unchanged.
 */
export function ManagerHomeActionsSection({
  role,
  activeMeeting,
  pendingApprovalCount,
  pendingTagAlongCount,
  myRequestsBadgeCount,
}: ManagerHomeActionsSectionProps) {
  const { width: windowWidth } = useWindowDimensions();
  const quickActionColumns = Math.max(3, Math.floor((windowWidth - 32 + 8) / (78 + 8)));

  return (
    <>
      <BizSectionHeader title="Your tasks" />
      <XStack gap="$2.5">
        <BizPrimaryActionCard
          variant="dark"
          icon={<Plus size={18} color="#FFFFFF" strokeWidth={1.75} />}
          title="Create a client"
          subtitle="Company and city first"
          onPress={() => router.push(getDashboardActionHref('manager-create-client', role))}
        />
        <BizPrimaryActionCard
          variant="alt"
          icon={<Handshake size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          title="Record a meeting"
          subtitle="Pick a client first"
          onPress={() => router.push(getDashboardActionHref('manager-record-meeting', role))}
          active={activeMeeting}
        />
      </XStack>

      <BizSectionHeader title="Manager Actions" />
      {/* Keep the same responsive grid rhythm as Sales/RSR Home: complete
          rows spread across the width, while a partial final row stays grouped
          from the left. */}
      <YStack gap={16}>
        {(() => {
          const tiles: ReactNode[] = [
            // Requests inbox: client-edit, PO-confirmation, and tag-along rows
            // share one destination. The badge covers all pending requests.
            <BizQuickAction key="approvals" icon={<PenLine size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Approvals" badgeCount={pendingApprovalCount + pendingTagAlongCount} onPress={() => router.push(getDashboardActionHref('manager-approvals', role))} />,
            // Outgoing counterpart of "Approvals" above — a manager also acts as
            // a requester (own client visits, tag-alongs, PO confirmations,
            // client edits on a client they don't own); this shows the status
            // of THEIR OWN requests, same Sales/RSR "My Requests" precedent.
            <BizQuickAction key="my-requests" icon={<ClipboardCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Requests" badgeCount={myRequestsBadgeCount} onPress={() => router.push('/(manager)/more/my-requests/index')} />,
            <BizQuickAction key="my-team" icon={<UserRound size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Team" onPress={() => router.push(getDashboardActionHref('manager-team', role))} />,
            <BizQuickAction key="clients" icon={<Building2 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Clients" onPress={() => router.push(getDashboardActionHref('manager-clients', role))} />,
            <BizQuickAction key="meeting-details" icon={<CalendarDays size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Meeting Details" onPress={() => router.push(getDashboardActionHref('manager-sales-history', role))} />,
            <BizQuickAction key="lost-opportunities" icon={<CircleOff size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Lost Opportunities" onPress={() => router.push('/(manager)/more/lost-opportunities')} />,
            <BizQuickAction key="reports" icon={<ChartNoAxesCombined size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Reports" onPress={() => router.push('/(manager)/more/reports')} />,
            <BizQuickAction key="office-map" icon={<MapPinned size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Office Map" onPress={() => router.push('/(manager)/more/maps')} />,
            <BizQuickAction key="notifications" icon={<Bell size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Notifications" onPress={() => router.push('/(manager)/more/notifications')} />,
            <BizQuickAction key="sync-history" icon={<History size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Sync History" onPress={() => router.push('/(manager)/more/sync-history')} />,
            <BizQuickAction key="account" icon={<ShieldCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Account" onPress={() => router.push('/(manager)/more/account')} />,
          ];
          const rows: ReactNode[][] = [];
          for (let i = 0; i < tiles.length; i += quickActionColumns) rows.push(tiles.slice(i, i + quickActionColumns));
          return rows.map((row, index) => (
            <XStack key={index} gap={8} justifyContent={row.length === quickActionColumns ? 'space-between' : 'flex-start'}>
              {row}
            </XStack>
          ));
        })()}
      </YStack>
    </>
  );
}
