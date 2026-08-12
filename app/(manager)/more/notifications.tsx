import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Archive, Bell, PencilLine, RefreshCw, RotateCcw, SlidersHorizontal, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFilterScroll, type BizFilterOption } from '../../../components/bizlink/BizFilterScroll';
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../../components/bizlink/BizFilterSheetRow';
import { DateRangeFilterRow } from '../../../components/bizlink/DateRangeFilterRow';
import type { DateRange } from '../../../components/bizlink/DateRangePickerModal';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { getManagerNotificationFeedItems, type ManagerNotificationCategory, type ManagerNotificationFeedItem } from '../../../lib/manager-notification-feed-service';
import { archiveNotifications, clearNotifications, getArchivedNotificationIds, getClearedNotificationIds, getReadNotificationIds, markNotificationRead } from '../../../lib/notification-unread';
import { isWithinDateRange } from '../../../lib/date-range';
import { timeAgo } from '../../../lib/time-ago';

type Filter = 'all' | ManagerNotificationCategory;
type StatusFilter = 'all' | 'archived';
// Keep the two primary filters visible in the compact chip row. Secondary
// notification categories live in the Filters sheet below, matching the
// Manager wireframe's compact header treatment.
const QUICK_FILTERS: BizFilterOption<Filter>[] = [
  { value: 'all', label: 'All' },
  { value: 'approvals', label: 'Approvals' },
];
const CATEGORY_FILTERS: BizFilterOption<Filter>[] = [
  { value: 'all', label: 'All' },
  { value: 'tagalong', label: 'Tag-Along' },
  { value: 'lost', label: 'Lost' },
  { value: 'sync', label: 'Sync' },
];
const STATUS_FILTERS: BizFilterOption<StatusFilter>[] = [{ value: 'all', label: 'All' }, { value: 'archived', label: 'Archived' }];

export default function ManagerNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useBizlinkColors();
  const { profileId } = useSession();
  const [feed, setFeed] = useState<ManagerNotificationFeedItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all([getManagerNotificationFeedItems(profileId), getReadNotificationIds(), getArchivedNotificationIds(), getClearedNotificationIds()])
      .then(([items, ids, archived, cleared]) => { setFeed(items); setReadIds(ids); setArchivedIds(archived); setClearedIds(cleared); })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : 'Could not load notifications.'); })
      .finally(() => { setLoading(false); setLoaded(true); });
  }, [profileId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => feed.filter((item) => {
    if (clearedIds.has(item.id)) return false;
    if (statusFilter === 'archived' ? !archivedIds.has(item.id) : archivedIds.has(item.id)) return false;
    if (filter !== 'all' && item.category !== filter) return false;
    return isWithinDateRange(new Date(item.timestamp), dateRange);
  }), [archivedIds, clearedIds, dateRange, feed, filter, statusFilter]);
  const filtersActive = filter !== 'all' || dateRange !== null || statusFilter !== 'all';

  function icon(item: ManagerNotificationFeedItem): React.ReactNode {
    if (item.category === 'approvals') return <PencilLine size={18} color={colors.brand} strokeWidth={1.8} />;
    if (item.category === 'tagalong') return <Users size={18} color={colors.brand} strokeWidth={1.8} />;
    if (item.category === 'lost') return <RotateCcw size={18} color={colors.orange} strokeWidth={1.8} />;
    return item.syncKind === 'failed' ? <AlertTriangle size={18} color={colors.red} strokeWidth={1.8} /> : <RefreshCw size={18} color={colors.brand} strokeWidth={1.8} />;
  }
  function press(item: ManagerNotificationFeedItem): void {
    if (!readIds.has(item.id)) { setReadIds((prev) => new Set(prev).add(item.id)); markNotificationRead(item.id).catch(() => undefined); }
    // A manager's own tag-along ask to a teammate is inserted pre-accepted
    // (lib/tag-along-manager-service.ts) — there is never a pending decision
    // to check on, so this notification is informational only; tapping it
    // just marks it read, same as any other already-resolved item.
    if (item.category === 'approvals') router.push('/(manager)/approvals');
    else if (item.category === 'sync') router.push('/(manager)/more/sync-history');
    else if (item.category !== 'tagalong') router.push('/(manager)/more/lost-opportunities/index');
  }
  function confirmArchive(ids: string[]): void {
    if (ids.length === 0) return;
    Alert.alert('Archive notifications?', `Hide ${ids.length === 1 ? 'this notification' : `${ids.length} notifications`} from the active list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: () => {
          archiveNotifications(ids)
            .then(() => setArchivedIds((prev) => new Set([...prev, ...ids])))
            .catch(() => Alert.alert('Could not archive notifications', 'Your notification list was not changed. Please try again.'));
        },
      },
    ]);
  }
  function confirmClear(ids: string[]): void {
    if (ids.length === 0) return;
    Alert.alert('Clear notifications?', `Permanently hide ${ids.length === 1 ? 'this notification' : `${ids.length} notifications`} on this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearNotifications(ids)
            .then(() => setClearedIds((prev) => new Set([...prev, ...ids])))
            .catch(() => Alert.alert('Could not clear notifications', 'Your notification list was not changed. Please try again.'));
        },
      },
    ]);
  }
  function resetFilters(): void { setFilter('all'); setDateRange(null); setStatusFilter('all'); }

  return <YStack flex={1} backgroundColor={colors.canvas} paddingTop={insets.top}>
    <BizTopBar title="Notifications" fallbackHref="/(manager)" />
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$3" marginBottom="$2.5">
        <Text flex={1} fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} lineHeight={18}>Requests, approval outcomes, Tag-Along responses, and sync alerts. A local action is never presented as server-final until sync confirms it.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Open notification filters" onPress={() => setFilterOpen(true)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}><SlidersHorizontal size={18} color={colors.brand} strokeWidth={1.8} /></Pressable>
      </XStack>
      <YStack marginBottom="$3"><BizFilterScroll options={QUICK_FILTERS} value={filter} onChange={setFilter} /></YStack>
      {loading && !loaded ? <YStack alignItems="center" padding="$8"><Spinner size="large" color={colors.brand} /></YStack> : error ? <YStack alignItems="center" padding="$8" gap="$2.5"><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.red} textAlign="center">{error}</Text><Pressable onPress={load} hitSlop={8}><Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={colors.brand}>Retry</Text></Pressable></YStack> : visible.length === 0 ? <YStack alignItems="center" padding="$8" gap="$2.5"><Bell size={40} color={colors.muted} strokeWidth={1.75} /><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} textAlign="center">Wala pang notification sa filter na ito.</Text></YStack> : visible.map((item) => { const unread = !readIds.has(item.id); return <Pressable key={item.id} onPress={() => press(item)} hitSlop={4}><XStack gap="$3" alignItems="flex-start" backgroundColor={unread ? colors.tintA : colors.card} borderRadius={20} padding={16} marginBottom={10} minHeight={44}><YStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={colors.soft}>{icon(item)}</YStack><YStack flex={1} gap="$1"><XStack alignItems="center" gap="$1.5"><Text flex={1} fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={colors.text}>{item.title}</Text>{unread ? <YStack width={7} height={7} borderRadius={3.5} backgroundColor={colors.brand} /> : null}<Pressable accessibilityRole="button" accessibilityLabel={`Archive ${item.title}`} onPress={(event) => { event.stopPropagation(); confirmArchive([item.id]); }} hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Archive size={17} color={colors.muted} strokeWidth={1.75} /></Pressable></XStack><Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} lineHeight={17}>{item.body}</Text><Text fontSize={11} fontFamily={BIZLINK_FONTS.regular} color={colors.muted} marginTop="$1">{timeAgo(item.timestamp)}</Text></YStack></XStack></Pressable>; })}
    </ScrollView>
    <BizFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
      <BizFilterSheetRow label="Category" value={filter === 'approvals' ? 'Approvals' : CATEGORY_FILTERS.find((option) => option.value === filter)?.label ?? 'All'}><BizFilterScroll options={CATEGORY_FILTERS} value={filter} onChange={setFilter} /></BizFilterSheetRow>
      <DateRangeFilterRow range={dateRange} onApply={setDateRange} />
      <BizFilterSheetRow label="Status" value={statusFilter === 'archived' ? 'Archived' : 'All'}><BizFilterScroll options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} /></BizFilterSheetRow>
      <YStack gap="$2" paddingTop="$4">
        <Pressable accessibilityRole="button" onPress={() => confirmArchive(visible.filter((item) => !archivedIds.has(item.id)).map((item) => item.id))} disabled={!visible.some((item) => !archivedIds.has(item.id))} style={{ minHeight: 48, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', opacity: visible.some((item) => !archivedIds.has(item.id)) ? 1 : 0.45 }}><Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={colors.text}>Archive visible notifications</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => confirmClear(visible.map((item) => item.id))} disabled={visible.length === 0} style={{ minHeight: 48, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.red, alignItems: 'center', justifyContent: 'center', opacity: visible.length > 0 ? 1 : 0.45 }}><Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={colors.red}>Clear visible notifications</Text></Pressable>
      </YStack>
    </BizFilterSheet>
  </YStack>;
}
