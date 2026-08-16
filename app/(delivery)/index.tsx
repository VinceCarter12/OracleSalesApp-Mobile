import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Bell, History, Package, PackageX, Truck, User, Vault } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { firstName, initialsFromName } from '../../lib/display-name';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizStatCard } from '../../components/bizlink/BizStatCard';
import { BizHeroCard } from '../../components/bizlink/BizHeroCard';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizDashboardAlert } from '../../components/bizlink/BizDashboardAlert';
import { BizQuickAction } from '../../components/bizlink/BizQuickAction';
import { BizQuickActionGrid, computeQuickActionColumns } from '../../components/bizlink/BizQuickActionGrid';
import { SyncStatusChip } from '../../components/sync/SyncStatusChip';
import { SyncCenterSheet } from '../../components/sync/SyncCenterSheet';
import {
  formatPeso,
  formatShortDateTime,
  getDeliverySummary,
  isOpenForDelivery,
  isScheduledForToday,
  remainingCod,
  type DeliveryPo,
} from '../../lib/collection-delivery-data';
import { useDeliveryPos } from '../../lib/use-collection-delivery';
import { useSyncRefresh } from '../../lib/use-sync-refresh';

/**
 * F-007 first draft (2026-07-25): Driver dashboard — wireframe `d-home`
 * (Wireframe-Collection-Delivery-BizLink.html). Mock data only; the whole
 * delivery module is still DRAFT pending spec (OQ-5) — the banner below is
 * deliberate, mirroring the wireframe's own pendbanner. Flow decisions:
 * Meeting-2026-07-25-Collection-Delivery (incl. COD addendum).
 */

// One outcome (web 044): delivered / failed(= backload) / pending. Static
// palette, same precedent as OUTCOME_BADGE_STYLES.
function PoBadge({ po }: { po: DeliveryPo }) {
  if (po.status === 'delivered') {
    return <StatusBadge label={po.seq ? `#${po.seq} · Delivered` : 'Delivered'} background={COLORS.greenSoft} color={COLORS.ledgeGreen} />;
  }
  if (po.status === 'failed') {
    return <StatusBadge label="Backload" background={COLORS.redSoft} color={COLORS.ledgeRed} />;
  }
  if (po.status === 'partial') {
    return <StatusBadge label="Partial" background={COLORS.purpleSoft} color={COLORS.purple} />;
  }
  if (po.onTheWay) {
    return <StatusBadge label="On the way" background={COLORS.amberSoft} color={COLORS.orange} />;
  }
  return <StatusBadge label="Pending" background={COLORS.blueSoft} color={COLORS.blue} />;
}

function PoPreviewRow({ po, onPress }: { po: DeliveryPo; onPress: () => void }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <Pressable onPress={onPress}>
      <XStack
        alignItems="center"
        gap="$3"
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={14}
        marginBottom={10}
      >
        <YStack width={36} height={36} borderRadius={13} backgroundColor={BIZLINK_COLORS.tintA} alignItems="center" justifyContent="center">
          <Package size={16} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
        </YStack>
        <YStack flex={1} gap="$0.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
            {po.po} · {po.client}
          </Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} numberOfLines={1}>
            {po.area}
            {po.cod && po.status === 'partial'
              ? ` · COD balance ${formatPeso(remainingCod(po))}`
              : po.cod && po.codDue
                ? ` · COD ${formatPeso(po.codDue)}`
                : ''}
          </Text>
          {po.onTheWay && po.claimedBy ? (
            <XStack alignItems="center" gap="$1.5">
              <Truck size={12} color={COLORS.orange} strokeWidth={1.75} />
              <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={COLORS.orange}>
                {po.claimedBy} is bringing it
              </Text>
            </XStack>
          ) : null}
          {po.syncedAt ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Received {formatShortDateTime(po.syncedAt)}
            </Text>
          ) : null}
        </YStack>
        <PoBadge po={po} />
      </XStack>
    </Pressable>
  );
}

export default function DeliveryDashboardScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { fullName } = useSession();
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  // B-023: remount the chip on sheet-close, same as the other dashboards.
  const [syncChipKey, setSyncChipKey] = useState(0);
  // F-007 Phase 1: real data from the local mirror; re-read on focus.
  const { pos, refresh } = useDeliveryPos();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  // Pull down to fetch today's PO list now instead of waiting for the 30s timer.
  const { refreshing, onRefresh } = useSyncRefresh(refresh);

  // Dashboard shows only TODAY's deliveries — the mirror holds past days too.
  const todayPos = pos.filter((p) => isScheduledForToday(p.scheduledFor));
  const summary = getDeliverySummary(todayPos);
  const preview = todayPos.filter((p) => isOpenForDelivery(p.status)).slice(0, 3);
  const greetingName = firstName(fullName) || 'Driver';
  const { width: windowWidth } = useWindowDimensions();
  const quickActionColumns = computeQuickActionColumns(windowWidth, 16);
  const quickActions = [
    <BizQuickAction key="po-list" icon={<Package size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="PO List" badgeCount={summary.pendingCount} onPress={() => router.push('/(delivery)/pos')} />,
    <BizQuickAction key="remit" icon={<Vault size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Remit" onPress={() => router.push('/(delivery)/remit')} />,
    <BizQuickAction key="history" icon={<History size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="History" onPress={() => router.push('/(delivery)/history')} />,
    <BizQuickAction key="account" icon={<User size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />} label="Account" onPress={() => router.push('/(delivery)/account')} />,
  ];

  const openDeliver = (id: string) =>
    router.push({ pathname: '/(delivery)/deliver', params: { id } });

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Avatar initials={initialsFromName(fullName)} background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
        <YStack gap="$1">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15.5} color={BIZLINK_COLORS.text}>
            Hello, {greetingName}!
          </Text>
          <StatusBadge label="Delivery" background={COLORS.greenTint} color={COLORS.ledgeGreen} />
        </YStack>
        <Pressable onPress={() => setSyncSheetOpen(true)} style={{ marginLeft: 'auto' }} hitSlop={6}>
          <YStack width={44} height={44} borderRadius={22} backgroundColor={BIZLINK_COLORS.card} alignItems="center" justifyContent="center">
            <Bell size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
          </YStack>
        </Pressable>
      </XStack>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BIZLINK_COLORS.brand}
            colors={[BIZLINK_COLORS.brand]}
          />
        }
      >
        <XStack gap={10} marginTop={10}>
          <YStack flex={1}>
            <BizStatCard
              tone="tintA"
              value={summary.pendingCount}
              label="POs to deliver"
              caption="assigned to you"
              onPress={() => router.push('/(delivery)/pos')}
            />
          </YStack>
          <YStack flex={1}>
            <BizStatCard
              tone="tintB"
              value={summary.backloadCount}
              label="Backloads"
              caption="goods that came back"
              onPress={() => router.push('/(delivery)/pos')}
            />
          </YStack>
        </XStack>

        <BizHeroCard
          value={formatPeso(summary.codOnHand)}
          label="COD for remittance"
          caption="not yet remitted"
          onPress={() => router.push('/(delivery)/remit')}
        />

        {/* Wireframe d-home: Actions are the dashboard's main focus, surfaced
            directly under the hero (before the deliveries list, not buried). */}
        <BizSectionHeader title="Actions" />
        <BizQuickActionGrid actions={quickActions} columns={quickActionColumns} />

        <BizSectionHeader title="Today's deliveries" actionLabel="View all" onAction={() => router.push('/(delivery)/pos')} />
        {preview.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">
            All deliveries are done!
          </Text>
        ) : (
          preview.map((po) => <PoPreviewRow key={po.id} po={po} onPress={() => openDeliver(po.id)} />)
        )}

        {summary.backloadCount > 0 ? (
          <BizDashboardAlert
            tone="amber"
            icon={<PackageX size={18} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />}
            title={`${summary.backloadCount} POs backloaded today`}
            caption="Goods came back — waiting for the dispatcher or admin to take action"
            onPress={() => router.push('/(delivery)/pos')}
          />
        ) : null}

        {/* Wireframe d-home: Sync status lives at the bottom of the dashboard. */}
        <BizSectionHeader title="Sync" />
        <SyncStatusChip key={syncChipKey} onPress={() => setSyncSheetOpen(true)} />
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
