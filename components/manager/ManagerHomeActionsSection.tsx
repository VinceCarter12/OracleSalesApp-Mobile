import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import {
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleOff,
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

const QUICK_ACTION_COLUMN_WIDTH = 78;
const QUICK_ACTION_GAP = 8;

function computeQuickActionColumns(screenWidth: number, horizontalPadding: number): number {
  const available = screenWidth - horizontalPadding * 2;
  const calculated = Math.floor((available + QUICK_ACTION_GAP) / (QUICK_ACTION_COLUMN_WIDTH + QUICK_ACTION_GAP));
  // Manager's phone layout keeps Sync History + Account together on the
  // final row, matching the four-column Sales/RSR composition. A very narrow
  // device still falls back to the safe three-column layout.
  return screenWidth >= 344 ? 4 : Math.max(3, calculated);
}

interface ManagerHomeActionsSectionProps {
  role: UserRole | null;
  activeMeeting: boolean;
  pendingApprovalCount: number;
  pendingTagAlongCount: number;
}

/** Manager Home's primary actions and responsive Manager Actions grid. */
export function ManagerHomeActionsSection({
  role,
  activeMeeting,
  pendingApprovalCount,
  pendingTagAlongCount,
}: ManagerHomeActionsSectionProps) {
  const { width: windowWidth } = useWindowDimensions();
  const quickActionColumns = computeQuickActionColumns(windowWidth, 16);
  const availableWidth = Math.max(0, windowWidth - 32);
  // Use one calculated column gap for every row. This keeps partial rows on
  // the same vertical tracks as the complete rows above (Account under
  // Reports), while still filling the available width edge to edge.
  const minimumGap = quickActionColumns >= 4 ? 0 : QUICK_ACTION_GAP;
  const quickActionGap = quickActionColumns > 1
    ? Math.max(minimumGap, (availableWidth - quickActionColumns * QUICK_ACTION_COLUMN_WIDTH) / (quickActionColumns - 1))
    : QUICK_ACTION_GAP;

  const tiles: ReactNode[] = [
    <BizQuickAction key="approvals" icon={<PenLine size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Approvals" badgeCount={pendingApprovalCount + pendingTagAlongCount} onPress={() => router.push(getDashboardActionHref('manager-approvals', role))} />,
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

  return (
    <>
      <BizSectionHeader title="Your tasks" />
      <XStack gap="$2.5">
        <BizPrimaryActionCard variant="dark" icon={<Plus size={18} color="#FFFFFF" strokeWidth={1.75} />} title="Create a client" subtitle="Company and city first" onPress={() => router.push(getDashboardActionHref('manager-create-client', role))} />
        <BizPrimaryActionCard variant="alt" icon={<Handshake size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} title="Record a meeting" subtitle="Pick a client first" onPress={() => router.push(getDashboardActionHref('manager-record-meeting', role))} active={activeMeeting} />
      </XStack>

      <BizSectionHeader title="Manager Actions" />
      <YStack gap={16}>
        {rows.map((row, index) => (
          <XStack key={index} gap={quickActionGap} justifyContent="flex-start">
            {row}
          </XStack>
        ))}
      </YStack>
    </>
  );
}
