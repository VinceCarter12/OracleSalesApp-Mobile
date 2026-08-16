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
  ClipboardList,
  MapPinned,
  PenLine,
  Plus,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { XStack } from 'tamagui';
import { BIZLINK_COLORS } from '../../lib/theme';
import { getDashboardActionHref } from '../../lib/dashboard-action-registry';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { BizPrimaryActionCard } from '../bizlink/BizPrimaryActionCard';
import { BizQuickAction } from '../bizlink/BizQuickAction';
import { BizQuickActionGrid, computeQuickActionColumns } from '../bizlink/BizQuickActionGrid';
import type { UserRole } from '../../types';

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
  const tiles = [
    <BizQuickAction key="approvals" icon={<PenLine size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Approvals" badgeCount={pendingApprovalCount + pendingTagAlongCount} onPress={() => router.push(getDashboardActionHref('manager-approvals', role))} />,
    <BizQuickAction key="my-team" icon={<UserRound size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="My Team" onPress={() => router.push(getDashboardActionHref('manager-team', role))} />,
    <BizQuickAction key="clients" icon={<Building2 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Clients" onPress={() => router.push(getDashboardActionHref('manager-clients', role))} />,
    <BizQuickAction key="meeting-details" icon={<CalendarDays size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Meeting Details" onPress={() => router.push(getDashboardActionHref('manager-sales-history', role))} />,
    <BizQuickAction key="tag-along-history" icon={<ClipboardList size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Tag-Along Attendance" onPress={() => router.push('/(manager)/tag-along-history')} />,
    <BizQuickAction key="lost-opportunities" icon={<CircleOff size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Lost Opportunities" onPress={() => router.push('/(manager)/more/lost-opportunities')} />,
    <BizQuickAction key="reports" icon={<ChartNoAxesCombined size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Reports" onPress={() => router.push('/(manager)/more/reports')} />,
    <BizQuickAction key="office-map" icon={<MapPinned size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Office Map" onPress={() => router.push('/(manager)/more/maps')} />,
    <BizQuickAction key="notifications" icon={<Bell size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Notifications" onPress={() => router.push('/(manager)/more/notifications')} />,
    <BizQuickAction key="sync-history" icon={<History size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Sync History" onPress={() => router.push('/(manager)/more/sync-history')} />,
    <BizQuickAction key="account" icon={<ShieldCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Account" onPress={() => router.push('/(manager)/more/account')} />,
  ];
  return (
    <>
      <BizSectionHeader title="Your tasks" />
      <XStack gap="$2.5">
        <BizPrimaryActionCard variant="dark" icon={<Plus size={18} color="#FFFFFF" strokeWidth={1.75} />} title="Create a client" subtitle="Company and city first" onPress={() => router.push(getDashboardActionHref('manager-create-client', role))} />
        <BizPrimaryActionCard variant="alt" icon={<Handshake size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} title="Record a meeting" subtitle="Pick a client first" onPress={() => router.push(getDashboardActionHref('manager-record-meeting', role))} active={activeMeeting} />
      </XStack>

      <BizSectionHeader title="Manager Actions" />
      <BizQuickActionGrid actions={tiles} columns={quickActionColumns} />
    </>
  );
}
