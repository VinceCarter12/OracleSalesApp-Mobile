import { router } from 'expo-router';
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
  Users,
} from 'lucide-react-native';
import { XStack } from 'tamagui';
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
}: ManagerHomeActionsSectionProps) {
  return (
    <>
      <BizSectionHeader title="Mga Gawain" />
      <XStack gap="$2.5">
        <BizPrimaryActionCard
          variant="dark"
          icon={<Plus size={18} color="#FFFFFF" strokeWidth={1.75} />}
          title="Gumawa ng client"
          subtitle="Company at city muna"
          onPress={() => router.push(getDashboardActionHref('manager-create-client', role))}
        />
        <BizPrimaryActionCard
          variant="alt"
          icon={<Handshake size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          title="I-record ang meeting"
          subtitle="Pumili muna ng client"
          onPress={() => router.push(getDashboardActionHref('manager-record-meeting', role))}
          active={activeMeeting}
        />
      </XStack>

      <BizSectionHeader title="Manager Actions" />
      <XStack gap="$2.5" flexWrap="wrap">
        {/* Batch 6 PR B (ADR-052, F-205 reversal): Wireframe-Manager-BizLink.html
            line 487's "Approvals" Quick Action, restored — client-edit +
            PO-confirmation requests only (Wireframe line 687: tag-along
            keeps its own separate flow below, unchanged). Badge count now
            wired (2026-08-04 Full Badge Implementation) — shows pending
            client-edit + PO-confirmation requests. */}
        <BizQuickAction
          icon={<PenLine size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Approvals"
          badgeCount={pendingApprovalCount}
          onPress={() => router.push(getDashboardActionHref('manager-approvals', role))}
        />
        <BizQuickAction
          icon={<Users size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Tag-Along"
          badgeCount={pendingTagAlongCount}
          onPress={() => router.push(getDashboardActionHref('manager-tag-along', role))}
        />
        <BizQuickAction
          icon={<UserRound size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="My Team"
          onPress={() => router.push(getDashboardActionHref('manager-team', role))}
        />
        <BizQuickAction
          icon={<Building2 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Clients"
          onPress={() => router.push(getDashboardActionHref('manager-clients', role))}
        />
        <BizQuickAction
          icon={<CalendarDays size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Meeting Details"
          onPress={() => router.push(getDashboardActionHref('manager-sales-history', role))}
        />
        <BizQuickAction
          icon={<CircleOff size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Lost Opportunities"
          onPress={() => router.push('/(manager)/more/lost-opportunities')}
        />
        <BizQuickAction
          icon={<ChartNoAxesCombined size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Reports"
          onPress={() => router.push('/(manager)/more/reports')}
        />
        <BizQuickAction
          icon={<MapPinned size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Office Map"
          onPress={() => router.push('/(manager)/more/maps')}
        />
        <BizQuickAction
          icon={<Bell size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Notifications"
          onPress={() => router.push('/(manager)/more/notifications')}
        />
        <BizQuickAction
          icon={<History size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Sync History"
          onPress={() => router.push('/(manager)/more/sync-history')}
        />
        <BizQuickAction
          icon={<ShieldCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          label="Account"
          onPress={() => router.push('/(manager)/more/account')}
        />
      </XStack>
    </>
  );
}
