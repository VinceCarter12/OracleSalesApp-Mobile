import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DELIVERY_POS, formatPeso, type DeliveryPo } from '../../lib/collection-delivery-data';

/**
 * F-007 first draft (2026-07-25): PO List — wireframe `d-pos`, read-only for
 * now. Not yet built this pass: filters, the Deliver PO flow (plate number +
 * proof photo + optional signature/receiver, COD payment step, Failed
 * attempt vs Backload actions). Sequence badge shows ACTUAL visit order
 * (driver-driven, not pre-assigned — 2026-07-25 decision).
 */

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

function PoRow({ po }: { po: DeliveryPo }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const done = po.status === 'delivered' || po.status === 'backload';
  return (
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
          {po.area} · {po.items}
        </Text>
        <XStack gap="$2.5">
          {po.cod && po.codDue ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.navy}>
              COD · {formatPeso(po.codDue)}
            </Text>
          ) : null}
          {po.time ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{po.time}</Text>
          ) : null}
          {po.plate ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{po.plate}</Text>
          ) : null}
        </XStack>
      </YStack>
      <PoBadge po={po} />
    </XStack>
  );
}

export default function DeliveryPosScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$2">
        <Text fontSize={21} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-0.4} color={BIZLINK_COLORS.text}>
          Purchase Orders
        </Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        {DELIVERY_POS.map((po) => (
          <PoRow key={po.id} po={po} />
        ))}
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={14} lineHeight={18}>
          Walang GPS sa delivery module (per confirmed scope) — timestamp + proof photo lang.{'\n'}
          Failed attempt = 3-day follow-up bago auto-delete. Backload = same-day terminal outcome, walang countdown.
        </Text>
      </ScrollView>
    </YStack>
  );
}
