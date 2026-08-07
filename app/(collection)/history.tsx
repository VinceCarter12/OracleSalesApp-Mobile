import { useCallback, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Vault } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK, COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { formatPeso, formatShortDateTime } from '../../lib/collection-delivery-data';
import { useRemittanceHistory, type RemittanceHistoryEntry } from '../../lib/use-remittance';
import type { RemitDestination } from '../../lib/remittance-write';

/**
 * F-007 Remittance History — the collector's submitted `remittances` (web 043),
 * read from the synced local mirror via useRemittanceHistory. Replaces the
 * earlier mock `COLLECTION_HISTORY` list. Filterable by destination; a row still
 * riding the outbox (sync_status != 'synced') is flagged "Syncing…" so the
 * collector knows it hasn't reached the office yet.
 */

type DestFilter = 'all' | RemitDestination;

const FILTERS: { key: DestFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'office', label: 'Office' },
  { key: 'bayad_center', label: 'Bayad Center' },
  { key: 'bank_deposit', label: 'Bank' },
];

const DESTINATION_LABEL: Record<RemitDestination, string> = {
  office: 'Office',
  bayad_center: 'Bayad Center',
  bank_deposit: 'Bank Deposit',
};

function DestinationBadge({ destination }: { destination: RemitDestination }) {
  if (destination === 'office') {
    return <StatusBadge label="Office" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />;
  }
  if (destination === 'bayad_center') {
    return <StatusBadge label="Bayad Center" background={COLORS.blueSoft} color={COLORS.blue} />;
  }
  return <StatusBadge label="Bank Deposit" background={COLORS.purpleSoft} color={COLORS.purple} />;
}

function HistoryRow({ entry }: { entry: RemittanceHistoryEntry }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const covers = entry.visitCount > 0 ? `${entry.visitCount} store${entry.visitCount > 1 ? 's' : ''}` : null;
  const receiver = entry.destination === 'office' ? entry.receiverName : DESTINATION_LABEL[entry.destination];
  const subParts = [formatShortDateTime(entry.submittedAt) || 'Just now', receiver, covers].filter(Boolean);
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
        <DestinationBadge destination={entry.destination} />
        {!entry.synced ? (
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.orange}>
            Syncing…
          </Text>
        ) : null}
      </YStack>
    </XStack>
  );
}

export default function CollectionHistoryScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { profileId } = useSession();
  const [filter, setFilter] = useState<DestFilter>('all');
  const { entries, loading, refresh } = useRemittanceHistory(profileId);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const list = entries.filter((e) => filter === 'all' || e.destination === filter);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Remittance History" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Text
          fontSize={10.5}
          fontFamily={BIZLINK_FONTS.semibold}
          letterSpacing={0.5}
          color={BIZLINK_COLORS.muted}
          marginBottom={8}
        >
          FILTER BY DESTINATION
        </Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom={12}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)}>
                <XStack
                  backgroundColor={on ? BIZLINK_COLORS.ink : BIZLINK_COLORS.soft}
                  borderRadius={999}
                  paddingHorizontal={16}
                  paddingVertical={9}
                >
                  <Text
                    fontSize={12.5}
                    fontFamily={BIZLINK_FONTS.medium}
                    color={on ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}
                  >
                    {f.label}
                  </Text>
                </XStack>
              </Pressable>
            );
          })}
        </XStack>

        {loading ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingVertical="$6">
            Loading…
          </Text>
        ) : list.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingVertical="$6">
            {entries.length === 0 ? 'No remittances yet.' : 'Nothing matches this filter.'}
          </Text>
        ) : (
          list.map((entry) => <HistoryRow key={entry.id} entry={entry} />)
        )}
      </ScrollView>
    </YStack>
  );
}
