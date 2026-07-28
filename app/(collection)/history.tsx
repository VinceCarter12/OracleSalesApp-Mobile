import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK, COLORS } from '../../lib/theme';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import {
  COLLECTION_HISTORY,
  formatPeso,
  type CollectionHistoryEntry,
  type CollectionHistoryResult,
} from '../../lib/collection-delivery-data';

/**
 * F-007 first draft (2026-07-25): Collection History — wireframe `c-history`.
 * Gated in the wireframe (customer info); the security gate isn't wired yet
 * (same as `today.tsx`), so this renders the list directly for now. Mock data
 * only — no F-007 schema exists (Database.md "Planned schema notes").
 */

type HistFilter = 'all' | CollectionHistoryResult;

const FILTERS: { key: HistFilter; label: string }[] = [
  { key: 'all', label: 'Lahat' },
  { key: 'collected', label: 'Collected' },
  { key: 'resched', label: 'Rescheduled' },
  { key: 'remitted', label: 'Remitted' },
];

function ResultBadge({ result }: { result: CollectionHistoryResult }) {
  if (result === 'collected') {
    return <StatusBadge label="Collected" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />;
  }
  if (result === 'resched') {
    return <StatusBadge label="Rescheduled" background={COLORS.amberSoft} color={COLORS.orange} />;
  }
  return <StatusBadge label="Remitted" background={COLORS.purpleSoft} color={COLORS.purple} />;
}

function HistoryRow({ entry }: { entry: CollectionHistoryEntry }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      padding={14}
      marginBottom={10}
    >
      <YStack flex={1} gap="$0.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
          {entry.store}
        </Text>
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          {entry.date} · {entry.method}
        </Text>
      </YStack>
      <YStack alignItems="flex-end" gap="$1">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
          {formatPeso(entry.amount)}
        </Text>
        <ResultBadge result={entry.result} />
      </YStack>
    </XStack>
  );
}

export default function CollectionHistoryScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<HistFilter>('all');

  const list = COLLECTION_HISTORY.filter((h) => filter === 'all' || h.result === filter);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Collection History" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Text
          fontSize={10.5}
          fontFamily={BIZLINK_FONTS.semibold}
          letterSpacing={0.5}
          color={BIZLINK_COLORS.muted}
          marginBottom={8}
        >
          FILTER BY RESULT
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

        {list.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingVertical="$6">
            Walang laman ang filter na ito.
          </Text>
        ) : (
          list.map((entry, i) => <HistoryRow key={`${entry.store}-${i}`} entry={entry} />)
        )}
      </ScrollView>
    </YStack>
  );
}
