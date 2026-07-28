import { useCallback } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Package, Truck } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { formatClockTime, formatPeso, type DeliveryPo } from '../../lib/collection-delivery-data';
import { useDeliveryPos } from '../../lib/use-collection-delivery';

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
          {po.cod && po.codDue ? (
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
        {po.onTheWay && po.status === 'pending' ? (
          <XStack alignItems="center" gap="$1.5" marginTop={2}>
            <Truck size={12} color={COLORS.orange} strokeWidth={1.75} />
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={COLORS.orange}>
              Dinadala na ni {po.claimedBy}
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

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Purchase Orders" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {pos.map((po) => (
          <PoRow
            key={po.id}
            po={po}
            onPress={
              po.status === 'pending'
                ? () => router.push({ pathname: '/(delivery)/deliver', params: { id: po.id } })
                : undefined
            }
          />
        ))}
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={14} lineHeight={18}>
          May GPS na ang delivery — kasabay ng proof photo (walang photo, walang pin).{'\n'}
          Isang araw, isang resulta: delivered o failed (= backload, kailangan ng photo proof).
        </Text>
      </ScrollView>
    </YStack>
  );
}
