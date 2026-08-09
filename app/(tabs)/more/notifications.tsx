import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';
import { AlertTriangle, Bell, CircleAlert, FileCheck2, RefreshCw, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { getNotificationFeedItems, type NotificationFeedItem } from '../../../lib/notification-feed-service';
import { getReadNotificationIds, markNotificationRead } from '../../../lib/notification-unread';
import { PO_CONFIRMATION_BADGE_TONES } from '../../../lib/policies/po-confirmation-status-policy';
import { timeAgo } from '../../../lib/time-ago';
import { useSession } from '../../../lib/session-store';
import { useClientFlowRoutes } from '../../../lib/use-role-routes';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFilterScroll, type BizFilterOption } from '../../../components/bizlink/BizFilterScroll';

/**
 * Wireframe `id="a-notifications"` (`aRenderNotifications()`, ~line 1233)
 * mocks a richer feed (deadline reminders, lost-opp claim, companion-request
 * Accept/Decline) — most of that still has no real client-side data source
 * or is intentionally out of scope here: deadline countdown is T-018,
 * lost-opp claim notices have no feed integration, and companion-request
 * Accept/Decline is Manager-side only (ADR-030 Pass 3, F-205) — this screen
 * never renders those buttons even though the wireframe's mock data does.
 * Real sources: sync-outbox counts (`getOutboxCounts()`, same source as the
 * Home screen's sync chip), this agent's own recent manager tag-alongs, and
 * this agent's own PO confirmation request statuses — assembled in
 * `lib/notification-feed-service.ts` (shared with the Home dashboard bell
 * and More-tile badge, see `lib/use-unread-notification-count.ts`).
 *
 * Notifications-Page-Handoff-2026-08-08 (Vince-confirmed, all three
 * decisions final): (1) local-only Unread/Read model
 * (`lib/notification-unread.ts`), no server-side read state; (2) filter
 * taxonomy moved to the wireframe's All/Unread/Action needed/Updates
 * (`aNotificationFilterVal`'s options, ~line 1236); (3) relative time
 * (`lib/time-ago.ts`) everywhere a timestamp shows.
 */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { profileId } = useSession();
  const clientFlowRoutes = useClientFlowRoutes();
  const [feedItems, setFeedItems] = useState<NotificationFeedItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<NotificationFilterValue>('all');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getNotificationFeedItems(profileId), getReadNotificationIds()])
      .then(([items, ids]) => {
        setFeedItems(items);
        setReadIds(ids);
      })
      .finally(() => {
        setLoading(false);
        setLoadedOnce(true);
      });
  }, [profileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const syncHistoryHref = '/(tabs)/more/sync-history' as Href;

  function hrefForItem(item: NotificationFeedItem): Href | undefined {
    if (item.category === 'sync') return syncHistoryHref;
    if (item.category === 'po' && item.meetingId) return clientFlowRoutes.meetingDetail(item.meetingId);
    if (item.category === 'tagalong') return '/(tabs)/more/my-requests' as Href;
    if (item.clientId) return clientFlowRoutes.clientDetail(item.clientId);
    return undefined;
  }

  function iconForItem(item: NotificationFeedItem): React.ReactNode {
    if (item.category === 'sync') {
      if (item.syncKind === 'failed') return <AlertTriangle size={16} color={BIZLINK_COLORS.red} strokeWidth={1.75} />;
      if (item.syncKind === 'conflict') return <CircleAlert size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />;
      return <RefreshCw size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />;
    }
    if (item.category === 'tagalong') return <Users size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />;
    const tone = item.poDisplayStatus ? PO_CONFIRMATION_BADGE_TONES[item.poDisplayStatus].color : 'muted';
    return <FileCheck2 size={16} color={BIZLINK_COLORS[tone]} strokeWidth={1.75} />;
  }

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return feedItems.filter((item) => {
      const unread = !readIds.has(item.id);
      if (filter === 'unread' && !unread) return false;
      if (filter === 'action' && item.kind !== 'action') return false;
      if (filter === 'update' && item.kind !== 'update') return false;
      if (!query) return true;
      return item.title.toLowerCase().includes(query) || item.body.toLowerCase().includes(query);
    });
  }, [feedItems, readIds, filter, search]);

  function handlePress(item: NotificationFeedItem): void {
    if (!readIds.has(item.id)) {
      setReadIds((prev) => new Set(prev).add(item.id));
      markNotificationRead(item.id).catch((err) =>
        console.error('[notifications] mark-read failed:', err instanceof Error ? err.message : String(err))
      );
    }
    const href = hrefForItem(item);
    if (href) router.push(href);
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Notifications" fallbackHref="/(tabs)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2.5" lineHeight={18}>
          Mga update na naka-sync sa phone mo. Action needed ang inuuna para walang makaligtaan.
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search notification..."
          placeholderTextColor={BIZLINK_COLORS.muted}
          style={{
            height: 52,
            borderRadius: 16,
            paddingHorizontal: 16,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            backgroundColor: BIZLINK_COLORS.card,
            borderWidth: 1,
            borderColor: BIZLINK_COLORS.line,
            marginBottom: 12,
          }}
        />
        <YStack marginBottom="$3">
          <BizFilterScroll options={NOTIFICATION_FILTERS} value={filter} onChange={setFilter} />
        </YStack>
        {loading && !loadedOnce ? (
          <YStack alignItems="center" padding="$8">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : items.length === 0 ? (
          <YStack alignItems="center" padding="$8" gap="$2.5">
            <Bell size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {feedItems.length === 0 ? 'Wala pang sync alerts.' : 'Walang notification na tumugma sa search/filter.'}
            </Text>
          </YStack>
        ) : (
          items.map((item, index) => {
            const unread = !readIds.has(item.id);
            return (
              <Pressable key={item.id} onPress={() => handlePress(item)} hitSlop={4}>
                <XStack
                  gap="$3"
                  alignItems="flex-start"
                  backgroundColor={unread ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.card}
                  borderRadius={20}
                  padding={16}
                  marginTop={index === 0 ? 0 : 10}
                  minHeight={44}
                >
                  {iconForItem(item)}
                  <YStack flex={1} gap="$1">
                    <XStack alignItems="center" gap="$1.5">
                      <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
                        {item.title}
                      </Text>
                      {unread ? (
                        <YStack width={7} height={7} borderRadius={3.5} backgroundColor={BIZLINK_COLORS.brand} />
                      ) : null}
                    </XStack>
                    <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={17}>
                      {item.body}
                    </Text>
                    <Text fontSize={11} fontFamily={BIZLINK_FONTS.regular} color={BIZLINK_COLORS.muted} marginTop="$1">
                      {timeAgo(item.timestamp)}
                    </Text>
                  </YStack>
                </XStack>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}

type NotificationFilterValue = 'all' | 'unread' | 'action' | 'update';

/** Wireframe `aRenderNotifications()`'s `filters` array (~line 1236): `[['all','All'],['unread','Unread'],['action','Action needed'],['update','Updates']]`. */
const NOTIFICATION_FILTERS: BizFilterOption<NotificationFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'action', label: 'Action needed' },
  { value: 'update', label: 'Updates' },
];
