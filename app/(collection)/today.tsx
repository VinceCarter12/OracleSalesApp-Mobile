import { useCallback, useReducer } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Footprints } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import {
  COLLECTION_STORES,
  formatClockTime,
  formatPeso,
  getCollectionSummary,
  type CollectionStore,
} from '../../lib/collection-delivery-data';

/**
 * F-007 first draft (2026-07-25): Today's List — wireframe `c-today`, read-only
 * for now. Not yet built this pass: the security gate (this list is customer
 * info — needs the SecurityGate wrap like Sales' clients tab), filters, and
 * the Collect Payment flow the rows will open into.
 */

function StoreRow({ store, onPress }: { store: CollectionStore; onPress?: () => void }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const collected = store.status === 'collected';
  const row = (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      paddingHorizontal={15}
      paddingVertical={13}
      marginBottom={10}
    >
      <Avatar initials={store.initials} size="sm" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
      <YStack flex={1} gap="$0.5">
        <Text
          fontFamily={BIZLINK_FONTS.semibold}
          fontSize={13.5}
          color={collected ? BIZLINK_COLORS.muted : BIZLINK_COLORS.text}
          textDecorationLine={collected ? 'line-through' : 'none'}
        >
          {store.name}
        </Text>
        <XStack gap="$2.5">
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{store.area}</Text>
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Due {formatPeso(store.due)}</Text>
          {store.visitedAt ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{formatClockTime(store.visitedAt)}</Text>
          ) : null}
        </XStack>
        {store.onTheWay && store.status === 'pending' ? (
          <XStack alignItems="center" gap="$1.5" marginTop={2}>
            <Footprints size={12} color={COLORS.orange} strokeWidth={1.75} />
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={COLORS.orange}>
              Kinukuha na ni {store.claimedBy}
            </Text>
          </XStack>
        ) : null}
      </YStack>
      {collected ? (
        <StatusBadge label="Collected" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />
      ) : store.status === 'rescheduled' ? (
        <StatusBadge label={`Moved to ${store.reschedTo}`} background={COLORS.amberSoft} color={COLORS.orange} />
      ) : store.onTheWay ? (
        <StatusBadge label="On the way" background={COLORS.amberSoft} color={COLORS.orange} />
      ) : (
        <StatusBadge label="Pending" background={COLORS.blueSoft} color={COLORS.blue} />
      )}
    </XStack>
  );
  return onPress ? <Pressable onPress={onPress}>{row}</Pressable> : row;
}

export default function CollectionTodayScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  // Mock data mutates in place (markStoreCollected/rescheduleStore); re-render
  // on focus so the list reflects a just-completed visit.
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  useFocusEffect(useCallback(() => refresh(), []));
  const summary = getCollectionSummary();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Today's List" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <YStack backgroundColor={BIZLINK_COLORS.tintA} borderRadius={24} padding={16} marginBottom={12}>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
            {summary.pendingCount} stores na lang
          </Text>
          <View height={6} borderRadius={99} backgroundColor="rgba(255,255,255,0.6)" overflow="hidden" marginTop={10}>
            <View height="100%" borderRadius={99} backgroundColor={BIZLINK_COLORS.brand} width={`${summary.visitedPct}%`} />
          </View>
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={8}>
            Nagde-decrement habang nabibisita — ang natapos ay naka-cross-out sa ibaba.
          </Text>
        </YStack>
        {COLLECTION_STORES.map((store) => (
          <StoreRow
            key={store.id}
            store={store}
            onPress={
              store.status === 'pending'
                ? () => router.push({ pathname: '/(collection)/visit', params: { id: String(store.id) } })
                : undefined
            }
          />
        ))}
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={14}>
          Bawat store visit ay may GPS pinpoint + timestamp.{'\n'}Walang route-line drawing — pinpoint lang per visit.
        </Text>
      </ScrollView>
    </YStack>
  );
}
