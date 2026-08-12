import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Bell, PencilLine, RefreshCw, RotateCcw, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFilterScroll, type BizFilterOption } from '../../../components/bizlink/BizFilterScroll';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { getManagerNotificationFeedItems, type ManagerNotificationCategory, type ManagerNotificationFeedItem } from '../../../lib/manager-notification-feed-service';
import { getReadNotificationIds, markNotificationRead } from '../../../lib/notification-unread';
import { timeAgo } from '../../../lib/time-ago';

type Filter = 'all' | ManagerNotificationCategory;
const FILTERS: BizFilterOption<Filter>[] = [
  { value: 'all', label: 'All' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'tagalong', label: 'Tag-Along' },
  { value: 'lost', label: 'Lost' },
  { value: 'sync', label: 'Sync' },
];

export default function ManagerNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useBizlinkColors();
  const { profileId } = useSession();
  const [feed, setFeed] = useState<ManagerNotificationFeedItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getManagerNotificationFeedItems(profileId), getReadNotificationIds()]).then(([items, ids]) => { setFeed(items); setReadIds(ids); }).catch((err: unknown) => { setError(err instanceof Error ? err.message : 'Could not load notifications.'); }).finally(() => { setLoading(false); setLoaded(true); });
  }, [profileId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const visible = useMemo(() => filter === 'all' ? feed : feed.filter((item) => item.category === filter), [feed, filter]);
  function icon(item: ManagerNotificationFeedItem): React.ReactNode {
    if (item.category === 'approvals') return <PencilLine size={18} color={colors.brand} strokeWidth={1.8} />;
    if (item.category === 'tagalong') return <Users size={18} color={colors.brand} strokeWidth={1.8} />;
    if (item.category === 'lost') return <RotateCcw size={18} color={colors.orange} strokeWidth={1.8} />;
    return item.syncKind === 'failed' ? <AlertTriangle size={18} color={colors.red} strokeWidth={1.8} /> : <RefreshCw size={18} color={colors.brand} strokeWidth={1.8} />;
  }
  function press(item: ManagerNotificationFeedItem): void {
    if (!readIds.has(item.id)) { setReadIds((prev) => new Set(prev).add(item.id)); markNotificationRead(item.id).catch(() => undefined); }
    if (item.category === 'approvals') router.push('/(manager)/approvals');
    else if (item.category === 'tagalong') router.push('/(manager)/more/my-requests/index');
    else if (item.category === 'sync') router.push('/(manager)/more/sync-history');
    else router.push('/(manager)/more/lost-opportunities/index');
  }
  return <YStack flex={1} backgroundColor={colors.canvas} paddingTop={insets.top}>
    <BizTopBar title="Notifications" fallbackHref="/(manager)" />
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} lineHeight={18} marginBottom="$2.5">
        Requests, approval outcomes, Tag-Along responses, and sync alerts. A local action is never presented as server-final until sync confirms it.
      </Text>
      <YStack marginBottom="$3"><BizFilterScroll options={FILTERS} value={filter} onChange={setFilter} /></YStack>
      {loading && !loaded ? <YStack alignItems="center" padding="$8"><Spinner size="large" color={colors.brand} /></YStack> : error ? <YStack alignItems="center" padding="$8" gap="$2.5"><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.red} textAlign="center">{error}</Text><Pressable onPress={load} hitSlop={8}><Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={colors.brand}>Retry</Text></Pressable></YStack> : visible.length === 0 ? <YStack alignItems="center" padding="$8" gap="$2.5"><Bell size={40} color={colors.muted} strokeWidth={1.75} /><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} textAlign="center">Wala pang notification sa filter na ito.</Text></YStack> : visible.map((item) => { const unread = !readIds.has(item.id); return <Pressable key={item.id} onPress={() => press(item)} hitSlop={4}><XStack gap="$3" alignItems="flex-start" backgroundColor={unread ? colors.tintA : colors.card} borderRadius={20} padding={16} marginBottom={10} minHeight={44}><YStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={colors.soft}>{icon(item)}</YStack><YStack flex={1} gap="$1"><XStack alignItems="center" gap="$1.5"><Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={colors.text}>{item.title}</Text>{unread ? <YStack width={7} height={7} borderRadius={3.5} backgroundColor={colors.brand} /> : null}</XStack><Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} lineHeight={17}>{item.body}</Text><Text fontSize={11} fontFamily={BIZLINK_FONTS.regular} color={colors.muted} marginTop="$1">{timeAgo(item.timestamp)}</Text></YStack></XStack></Pressable>; })}
    </ScrollView>
  </YStack>;
}
