import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Footprints } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import {
  formatClockTime,
  formatPeso,
  formatShortDateTime,
  getCollectionSummary,
  isScheduledForToday,
  sortAdditionalFirst,
  type CollectionStore,
} from '../../lib/collection-delivery-data';
import { useCollectionStores } from '../../lib/use-collection-delivery';
import { useSyncRefresh } from '../../lib/use-sync-refresh';

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
        <XStack alignItems="center" gap="$1.5">
          <Text
            fontFamily={BIZLINK_FONTS.semibold}
            fontSize={13.5}
            color={collected ? BIZLINK_COLORS.muted : BIZLINK_COLORS.text}
            textDecorationLine={collected ? 'line-through' : 'none'}
            flexShrink={1}
          >
            {store.name}
          </Text>
          {store.isAdditional && store.status === 'pending' ? (
            <StatusBadge label="Additional" background={COLORS.purpleSoft} color={COLORS.purple} />
          ) : null}
        </XStack>
        <XStack gap="$2.5">
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{store.area}</Text>
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Due {formatPeso(store.due)}</Text>
          {store.visitedAt ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{formatClockTime(store.visitedAt)}</Text>
          ) : null}
        </XStack>
        {store.syncedAt ? (
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={1}>
            Received {formatShortDateTime(store.syncedAt)}
          </Text>
        ) : null}
        {store.onTheWay && store.status === 'pending' ? (
          <XStack alignItems="center" gap="$1.5" marginTop={2}>
            <Footprints size={12} color={COLORS.orange} strokeWidth={1.75} />
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={COLORS.orange}>
              {store.claimedBy} is collecting it
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
  // F-007 Phase 1: real data from the local mirror; re-read on focus.
  const { stores, refresh } = useCollectionStores();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  // Pull down to fetch a just-published list now (see index.tsx dashboard).
  const { refreshing, onRefresh } = useSyncRefresh(refresh);
  const summary = getCollectionSummary(stores);
  // Two sections. "For today" = today's stops (Additional floated to the top so
  // a late urgent addition isn't stranded at the bottom). "All lists" = the
  // archive of days that have ENDED — today's rows are deliberately EXCLUDED
  // until the date rolls over, at which point they stop matching "today" and
  // fall into this section on their own.
  const todayStores = sortAdditionalFirst(stores.filter((s) => isScheduledForToday(s.scheduledFor)));
  const pastStores = sortAdditionalFirst(stores.filter((s) => !isScheduledForToday(s.scheduledFor)));

  const renderRow = (store: CollectionStore) => (
    <StoreRow
      key={store.id}
      store={store}
      onPress={
        store.status === 'pending'
          ? () => router.push({ pathname: '/(collection)/visit', params: { id: String(store.id) } })
          : undefined
      }
    />
  );

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Today's List" />
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
        <YStack backgroundColor={BIZLINK_COLORS.tintA} borderRadius={24} padding={16} marginBottom={12}>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
            {summary.pendingCount} stores left
          </Text>
          <View height={6} borderRadius={99} backgroundColor="rgba(255,255,255,0.6)" overflow="hidden" marginTop={10}>
            <View height="100%" borderRadius={99} backgroundColor={BIZLINK_COLORS.brand} width={`${summary.visitedPct}%`} />
          </View>
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={8}>
            The count goes down as you visit — finished stores are crossed out below.
          </Text>
        </YStack>
        <BizSectionHeader title="For today" helper={`${todayStores.length} ${todayStores.length === 1 ? 'store' : 'stores'}`} />
        {todayStores.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$2">
            No stores scheduled for today.
          </Text>
        ) : (
          todayStores.map(renderRow)
        )}

        <BizSectionHeader title="All lists" helper={`${pastStores.length} total`} />
        {pastStores.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$2">
            Past lists show up here once the day ends.
          </Text>
        ) : (
          pastStores.map(renderRow)
        )}

        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop={14}>
          Every store visit has a GPS pinpoint + timestamp.{'\n'}No route line is drawn — just a pinpoint per visit.
        </Text>
      </ScrollView>
    </YStack>
  );
}
