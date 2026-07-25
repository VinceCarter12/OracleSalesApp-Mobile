import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Bell, Ellipsis, Hourglass, Package, PackageCheck, TriangleAlert, Vault } from 'lucide-react-native';
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
import { SyncStatusChip } from '../../components/sync/SyncStatusChip';
import { SyncCenterSheet } from '../../components/sync/SyncCenterSheet';
import {
  DELIVERY_POS,
  formatPeso,
  getDeliverySummary,
  type DeliveryPo,
} from '../../lib/collection-delivery-data';

/**
 * F-007 first draft (2026-07-25): Driver dashboard — wireframe `d-home`
 * (Wireframe-Collection-Delivery-BizLink.html). Mock data only; the whole
 * delivery module is still DRAFT pending spec (OQ-5) — the banner below is
 * deliberate, mirroring the wireframe's own pendbanner. Flow decisions:
 * Meeting-2026-07-25-Collection-Delivery (incl. COD addendum).
 */

// Wireframe .b-pending/.b-followup/.b-delivered/.b-backload — static palette,
// same precedent as OUTCOME_BADGE_STYLES.
function PoBadge({ po }: { po: DeliveryPo }) {
  if (po.status === 'delivered') {
    return <StatusBadge label={po.seq ? `#${po.seq} · Delivered` : 'Delivered'} background={COLORS.greenSoft} color={COLORS.ledgeGreen} />;
  }
  if (po.status === 'backload') {
    return <StatusBadge label="Backload" background={COLORS.redSoft} color={COLORS.ledgeRed} />;
  }
  if (po.status === 'followup') {
    return <StatusBadge label={`Follow-up · day ${po.day} of 3`} background={COLORS.amberSoft} color={COLORS.orange} />;
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
            {po.items}
          </Text>
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

  const summary = getDeliverySummary();
  const preview = DELIVERY_POS.filter((p) => p.status === 'pending' || p.status === 'followup').slice(0, 3);
  const greetingName = firstName(fullName) || 'Driver';

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Avatar initials={initialsFromName(fullName)} background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
        <YStack gap="$1">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15.5} color={BIZLINK_COLORS.text}>
            Kamusta, {greetingName}!
          </Text>
          <StatusBadge label="Delivery" background={COLORS.greenTint} color={COLORS.ledgeGreen} />
        </YStack>
        <Pressable onPress={() => router.push('/(delivery)/more')} style={{ marginLeft: 'auto' }} hitSlop={6}>
          <YStack width={44} height={44} borderRadius={22} backgroundColor={BIZLINK_COLORS.card} alignItems="center" justifyContent="center">
            <Bell size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
          </YStack>
        </Pressable>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        {/* Wireframe d-home pendbanner: the delivery spec is still thin (OQ-5) —
            these screens are a proposal until the client specs the module. */}
        <XStack
          alignItems="center"
          gap="$2.5"
          backgroundColor={BIZLINK_COLORS.amberSoft}
          borderRadius={20}
          paddingHorizontal={16}
          paddingVertical={13}
          marginTop={4}
        >
          <TriangleAlert size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
          <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange} lineHeight={17}>
            DRAFT — pending spec (OQ-5). Proposal lang ang mga screen na ito hangga't hindi nase-spec ang delivery module.
          </Text>
        </XStack>

        <XStack gap={10} marginTop={10}>
          <YStack flex={1}>
            <BizStatCard
              tone="tintA"
              value={summary.pendingCount}
              label="POs to deliver"
              caption="assigned sa'yo"
              onPress={() => router.push('/(delivery)/pos')}
            />
          </YStack>
          <YStack flex={1}>
            <BizStatCard
              tone="tintB"
              value={summary.followUpCount}
              label="Follow-up"
              caption={summary.followUpDay ? `day ${summary.followUpDay} of 3` : 'wala'}
              onPress={() => router.push('/(delivery)/pos')}
            />
          </YStack>
        </XStack>

        <BizHeroCard
          value={formatPeso(summary.codOnHand)}
          label="COD for remittance"
          caption="hindi pa nare-remit"
          onPress={() => router.push('/(delivery)/remit')}
        />

        <SyncStatusChip key={syncChipKey} onPress={() => setSyncSheetOpen(true)} />

        {summary.followUpPo && summary.followUpDay ? (
          <BizDashboardAlert
            tone="amber"
            icon={<Hourglass size={18} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />}
            title={`${summary.followUpPo}: day ${summary.followUpDay} ng 3-day follow-up`}
            caption="Ma-a-auto-delete ang undelivered pagkatapos ng 3 araw"
            onPress={() => router.push('/(delivery)/pos')}
          />
        ) : null}

        <BizSectionHeader title="Today's deliveries" actionLabel="Tingnan lahat" onAction={() => router.push('/(delivery)/pos')} />
        {preview.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">
            Tapos na ang lahat ng deliveries!
          </Text>
        ) : (
          preview.map((po) => <PoPreviewRow key={po.id} po={po} onPress={() => router.push('/(delivery)/pos')} />)
        )}

        <BizSectionHeader title="Quick Actions" />
        <XStack gap="$2.5" flexWrap="wrap">
          <BizQuickAction
            icon={<Package size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="PO List"
            badgeCount={summary.pendingCount}
            onPress={() => router.push('/(delivery)/pos')}
          />
          <BizQuickAction
            icon={<PackageCheck size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Deliver"
            onPress={() => router.push('/(delivery)/pos')}
          />
          <BizQuickAction
            icon={<Vault size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Remit"
            onPress={() => router.push('/(delivery)/remit')}
          />
          <BizQuickAction
            icon={<Ellipsis size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="More"
            onPress={() => router.push('/(delivery)/more')}
          />
        </XStack>
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
