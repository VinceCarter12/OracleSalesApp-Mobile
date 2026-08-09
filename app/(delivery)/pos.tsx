import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Package, Truck } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { formatClockTime, formatPeso, formatShortDateTime, isOpenForDelivery, isScheduledForToday, remainingCod, type DeliveryPo } from '../../lib/collection-delivery-data';
import { useDeliveryPos } from '../../lib/use-collection-delivery';
import { useSyncRefresh } from '../../lib/use-sync-refresh';

/**
 * F-007 PO List — wireframe `d-pos`. Opens the Deliver PO flow for a pending
 * stop. One-outcome model (web 044): pending → delivered or failed(= backload).
 * Sequence badge shows ACTUAL visit order (driver-driven, not pre-assigned).
 */

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

function PoRow({ po, onPress }: { po: DeliveryPo; onPress?: () => void }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const done = po.status === 'delivered' || po.status === 'failed';
  const row = (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      paddingHorizontal={15}
      paddingVertical={13}
      marginBottom={10}
      opacity={done ? 0.7 : 1}
    >
      <YStack width={36} height={36} borderRadius={13} backgroundColor={BIZLINK_COLORS.tintA} alignItems="center" justifyContent="center">
        <Package size={16} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
      </YStack>
      <YStack flex={1} gap="$0.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
          {po.po} · {po.client}
        </Text>
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} numberOfLines={1}>
          {po.area}
        </Text>
        <XStack gap="$2.5">
          {po.cod && po.status === 'partial' ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={COLORS.purple}>
              COD balance · {formatPeso(remainingCod(po))}
            </Text>
          ) : po.cod && po.codDue ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.navy}>
              COD · {formatPeso(po.codDue)}
            </Text>
          ) : null}
          {po.timeOut ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{formatClockTime(po.timeOut)}</Text>
          ) : null}
          {po.plate ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{po.plate}</Text>
          ) : null}
        </XStack>
        {po.syncedAt ? (
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={1}>
            Received {formatShortDateTime(po.syncedAt)}
          </Text>
        ) : null}
        {po.onTheWay && po.status === 'pending' ? (
          <XStack alignItems="center" gap="$1.5" marginTop={2}>
            <Truck size={12} color={COLORS.orange} strokeWidth={1.75} />
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={COLORS.orange}>
              {po.claimedBy} is bringing it
            </Text>
          </XStack>
        ) : null}
      </YStack>
      <PoBadge po={po} />
    </XStack>
  );
  return onPress ? <Pressable onPress={onPress}>{row}</Pressable> : row;
}

export default function DeliveryPosScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  // F-007 Phase 1: real data from the local mirror; re-read on focus.
  const { pos, refresh } = useDeliveryPos();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const { refreshing, onRefresh } = useSyncRefresh(refresh);
  // Two sections. "For today" = today's POs. "All lists" = the archive of days
  // that have ENDED — today's rows are EXCLUDED until the date rolls over, at
  // which point they stop matching "today" and fall into this section on their own.
  const todayPos = pos.filter((p) => isScheduledForToday(p.scheduledFor));
  const pastPos = pos.filter((p) => !isScheduledForToday(p.scheduledFor));

  const renderRow = (po: DeliveryPo) => (
    <PoRow
      key={po.id}
      po={po}
      onPress={
        isOpenForDelivery(po.status)
          ? () => router.push({ pathname: '/(delivery)/deliver', params: { id: po.id } })
          : undefined
      }
    />
  );

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Purchase Orders" />
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
        <BizSectionHeader title="For today" helper={`${todayPos.length} ${todayPos.length === 1 ? 'PO' : 'POs'}`} />
        {todayPos.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$2">
            No POs scheduled for today.
          </Text>
        ) : (
          todayPos.map(renderRow)
        )}

        <BizSectionHeader title="All lists" helper={`${pastPos.length} total`} />
        {pastPos.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$2">
            Past POs show up here once the day ends.
          </Text>
        ) : (
          pastPos.map(renderRow)
        )}

        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={14} lineHeight={18}>
          Each delivery has GPS — captured with the proof photo (no photo, no pin).{'\n'}
          One day, one result: delivered or failed (= backload, needs a photo proof).
        </Text>
      </ScrollView>
    </YStack>
  );
}
