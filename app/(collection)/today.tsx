import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  COLLECTION_STORES,
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

function StoreRow({ store }: { store: CollectionStore }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const collected = store.status === 'collected';
  return (
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
          {store.time ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{store.time}</Text>
          ) : null}
        </XStack>
      </YStack>
      {collected ? (
        <StatusBadge label="Collected" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />
      ) : store.status === 'resched' ? (
        <StatusBadge label={`Moved to ${store.reschedTo}`} background={COLORS.amberSoft} color={COLORS.orange} />
      ) : (
        <StatusBadge label="Pending" background={COLORS.blueSoft} color={COLORS.blue} />
      )}
    </XStack>
  );
}

export default function CollectionTodayScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const summary = getCollectionSummary();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$2">
        <Text fontSize={21} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-0.4} color={BIZLINK_COLORS.text}>
          Today's List
        </Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
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
          <StoreRow key={store.id} store={store} />
        ))}
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={14}>
          Bawat store visit ay may GPS pinpoint + timestamp.{'\n'}Walang route-line drawing — pinpoint lang per visit.
        </Text>
      </ScrollView>
    </YStack>
  );
}
