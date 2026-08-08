import { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Vault } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { formatPeso, formatShortDateTime } from '../../lib/collection-delivery-data';
import { useCodRemittanceHistory, type CodRemittanceHistoryEntry } from '../../lib/use-remittance';

/**
 * F-007 Delivery COD Remittance History — the driver's submitted
 * `cod_remittances` (web 044, office-only), read from the synced local mirror
 * via useCodRemittanceHistory. Replaces the earlier "pending spec" stub now that
 * the COD remit write path is live. A row still riding the outbox is flagged
 * "Syncing…" so the driver knows it hasn't reached the office yet.
 */

function HistoryRow({ entry }: { entry: CodRemittanceHistoryEntry }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const covers = entry.poCount > 0 ? `${entry.poCount} PO${entry.poCount > 1 ? 's' : ''}` : null;
  const subParts = [formatShortDateTime(entry.submittedAt) || 'Just now', entry.receiverName || null, covers].filter(Boolean);
  return (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      padding={14}
      marginBottom={10}
    >
      <YStack width={40} height={40} borderRadius={14} backgroundColor={BIZLINK_COLORS.tintA} alignItems="center" justifyContent="center">
        <Vault size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
      </YStack>
      <YStack flex={1} gap="$0.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
          Remitted {formatPeso(entry.amountRemitted)}
        </Text>
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} numberOfLines={1}>
          {subParts.join(' · ')}
        </Text>
      </YStack>
      <YStack alignItems="flex-end" gap="$1">
        <StatusBadge label="Office" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />
        {!entry.synced ? (
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.orange}>
            Syncing…
          </Text>
        ) : null}
      </YStack>
    </XStack>
  );
}

export default function DeliveryHistoryScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { profileId } = useSession();
  const { entries, loading, refresh } = useCodRemittanceHistory(profileId);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Remittance History" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {loading ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingVertical="$6">
            Loading…
          </Text>
        ) : entries.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingVertical="$6">
            No COD remittances yet.
          </Text>
        ) : (
          entries.map((entry) => <HistoryRow key={entry.id} entry={entry} />)
        )}
      </ScrollView>
    </YStack>
  );
}
