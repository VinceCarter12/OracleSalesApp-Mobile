import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Bell, ClipboardList, History, Hourglass, User, Vault } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK, COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { firstName, initialsFromName } from '../../lib/display-name';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizStatCard } from '../../components/bizlink/BizStatCard';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizDashboardAlert } from '../../components/bizlink/BizDashboardAlert';
import { BizQuickAction } from '../../components/bizlink/BizQuickAction';
import { SyncStatusChip } from '../../components/sync/SyncStatusChip';
import { SyncCenterSheet } from '../../components/sync/SyncCenterSheet';
import {
  formatPeso,
  formatPesoCompact,
  formatShortDateTime,
  getCollectionSummary,
  isScheduledForToday,
  sortAdditionalFirst,
  type CollectionStore,
} from '../../lib/collection-delivery-data';
import { useCollectionStores } from '../../lib/use-collection-delivery';
import { useSyncRefresh } from '../../lib/use-sync-refresh';

/**
 * F-007 first draft (2026-07-25): Collector dashboard — wireframe `c-home`
 * (Wireframe-Collection-Delivery-BizLink.html). Mock data only; no F-007
 * schema exists yet (Database.md "Planned schema notes"). Flow decisions of
 * record: Meeting-2026-07-03 + Meeting-2026-07-25-Collection-Delivery.
 */

/** Wireframe `.hero` with the visited-progress bar — BizHeroCard has no bar slot, so built locally. */
function RemittanceHero({ amount, visitedPct, onPress }: { amount: number; visitedPct: number; onPress: () => void }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <YStack
      onPress={onPress}
      backgroundColor={BIZLINK_COLORS.ink}
      borderRadius={24}
      padding={18}
      marginTop={10}
      pressStyle={{ opacity: 0.9 }}
    >
      <View
        backgroundColor={BIZLINK_ON_INK.circleFill}
        borderRadius={999}
        paddingHorizontal={11}
        paddingVertical={4}
        alignSelf="flex-end"
      >
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>
          not yet remitted
        </Text>
      </View>
      <Text fontSize={42} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-1.5} color={BIZLINK_ON_INK.solid} marginTop={10}>
        {formatPeso(amount)}
      </Text>
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted} marginTop={8}>
        For remittance  ›
      </Text>
      <View height={6} borderRadius={99} backgroundColor={BIZLINK_ON_INK.circleFill} overflow="hidden" marginTop={10}>
        <View height="100%" borderRadius={99} backgroundColor="#8FD7B4" width={`${visitedPct}%`} />
      </View>
    </YStack>
  );
}

// Wireframe .b-collected/.b-resched/.b-pending — static palette, same
// precedent as OUTCOME_BADGE_STYLES (badge tints aren't theme-reactive yet).
function StoreBadge({ store }: { store: CollectionStore }) {
  if (store.status === 'collected') {
    return <StatusBadge label="Collected" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />;
  }
  if (store.status === 'rescheduled') {
    return <StatusBadge label={`Moved to ${store.reschedTo}`} background={COLORS.amberSoft} color={COLORS.orange} />;
  }
  if (store.onTheWay) {
    return <StatusBadge label="On the way" background={COLORS.amberSoft} color={COLORS.orange} />;
  }
  return <StatusBadge label="Pending" background={COLORS.blueSoft} color={COLORS.blue} />;
}

function RoutePreviewRow({ store, onPress }: { store: CollectionStore; onPress: () => void }) {
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
        <Avatar initials={store.initials} size="sm" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
        <YStack flex={1} gap="$0.5">
          <XStack alignItems="center" gap="$1.5">
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text} flexShrink={1}>{store.name}</Text>
            {store.isAdditional && store.status === 'pending' ? (
              <StatusBadge label="Additional" background={COLORS.purpleSoft} color={COLORS.purple} />
            ) : null}
          </XStack>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {store.area} · Due {formatPeso(store.due)}
          </Text>
          {store.syncedAt ? (
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Received {formatShortDateTime(store.syncedAt)}
            </Text>
          ) : null}
        </YStack>
        <StoreBadge store={store} />
        <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
      </XStack>
    </Pressable>
  );
}

export default function CollectionDashboardScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { fullName } = useSession();
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  // B-023: remount the chip on sheet-close, same as the other dashboards.
  const [syncChipKey, setSyncChipKey] = useState(0);
  // F-007 Phase 1: real data from the local mirror (synced down, web 043-046).
  // Re-read on focus so a just-published list / completed stop shows on return.
  const { stores, refresh } = useCollectionStores();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  // Pull-to-refresh: fetch the day's lists now instead of waiting for the 30s
  // timer. runSync's sync-complete re-reads the mirror; refresh() is belt-and-braces.
  const { refreshing, onRefresh } = useSyncRefresh(refresh);

  // Dashboard shows only TODAY's list — the mirror holds past days too.
  const todayStores = stores.filter((s) => isScheduledForToday(s.scheduledFor));
  const summary = getCollectionSummary(todayStores);
  // Additional (admin added mid-day) stores float to the front so the 3-row
  // route preview surfaces an urgent late addition instead of burying it.
  const pendingStores = sortAdditionalFirst(todayStores.filter((s) => s.status === 'pending'));
  const routePreview = pendingStores.slice(0, 3);
  const greetingName = firstName(fullName) || 'Collector';

  const openVisit = (storeId: string) =>
    router.push({ pathname: '/(collection)/visit', params: { id: storeId } });

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Avatar initials={initialsFromName(fullName)} background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
        <YStack gap="$1">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15.5} color={BIZLINK_COLORS.text}>
            Hello, {greetingName}!
          </Text>
          <StatusBadge label="Collection Officer" background={COLORS.greenTint} color={COLORS.ledgeGreen} />
        </YStack>
        <Pressable onPress={() => setSyncSheetOpen(true)} style={{ marginLeft: 'auto' }} hitSlop={6}>
          <YStack width={44} height={44} borderRadius={22} backgroundColor={BIZLINK_COLORS.card} alignItems="center" justifyContent="center">
            <Bell size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
          </YStack>
        </Pressable>
      </XStack>

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
        <XStack gap={10} marginTop={6}>
          <YStack flex={1}>
            <BizStatCard
              tone="tintA"
              value={summary.pendingCount}
              label="Stores remaining"
              caption={`${summary.visitedCount} of ${summary.total} visited`}
              onPress={() => router.push('/(collection)/today')}
            />
          </YStack>
          <YStack flex={1}>
            <BizStatCard
              tone="white"
              value={formatPesoCompact(summary.collectedTotal)}
              label="Collected today"
              caption="cash + check + gcash"
              onPress={() => router.push('/(collection)/remit')}
            />
          </YStack>
        </XStack>

        <RemittanceHero
          amount={summary.forRemittance}
          visitedPct={summary.visitedPct}
          onPress={() => router.push('/(collection)/remit')}
        />

        {/* Wireframe c-home: Actions are the dashboard's main focus, surfaced
            directly under the hero (before the route list, not buried). */}
        <BizSectionHeader title="Actions" />
        <XStack gap="$2.5" flexWrap="wrap">
          <BizQuickAction
            icon={<ClipboardList size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Today's List"
            badgeCount={summary.pendingCount}
            onPress={() => router.push('/(collection)/today')}
          />
          <BizQuickAction
            icon={<Vault size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Remit"
            onPress={() => router.push('/(collection)/remit')}
          />
          <BizQuickAction
            icon={<History size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="History"
            onPress={() => router.push('/(collection)/history')}
          />
          <BizQuickAction
            icon={<User size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Account"
            onPress={() => router.push('/(collection)/account')}
          />
        </XStack>

        <BizSectionHeader title="Today's route" actionLabel="View all" onAction={() => router.push('/(collection)/today')} />
        {routePreview.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">
            All of today’s visits are done!
          </Text>
        ) : (
          routePreview.map((store) => (
            <RoutePreviewRow key={store.id} store={store} onPress={() => openVisit(store.id)} />
          ))
        )}

        {summary.pendingCount > 0 ? (
          <BizDashboardAlert
            tone="amber"
            icon={<Hourglass size={18} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />}
            title={`${summary.pendingCount} stores not yet visited today`}
            caption="Reschedule the ones you can’t reach — don’t leave them blank"
            onPress={() => router.push('/(collection)/today')}
          />
        ) : null}

        {/* Wireframe c-home: Sync status lives at the bottom of the dashboard. */}
        <BizSectionHeader title="Sync" />
        <SyncStatusChip key={syncChipKey} onPress={() => setSyncSheetOpen(true)} />
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
