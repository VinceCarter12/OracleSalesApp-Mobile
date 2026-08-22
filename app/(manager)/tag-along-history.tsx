import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Camera, Search, SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { BizChip } from '../../components/bizlink/BizChip';
import { BizFloatingPager } from '../../components/bizlink/BizFloatingPager';
import { BizFilterSheet } from '../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../components/bizlink/BizFilterSheetRow';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import type { ManagerScope } from '../../lib/manager-scope';
import { useManagerAttendanceHistory } from '../../lib/use-manager-attendance-history';
import type { ManagerAttendanceRecord } from '../../lib/manager-attendance-history-service';
import { usePagination } from '../../lib/use-pagination';

type PhotoFilter = 'all' | 'with_photo' | 'photo_pending';
type AttendanceFilter = 'all' | 'mine' | 'accepted' | 'pending' | 'declined';

const ATTENDANCE_FILTERS: ReadonlyArray<{ value: AttendanceFilter; label: string }> = [
  { value: 'all', label: 'All records' },
  { value: 'mine', label: 'My meetings' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'pending', label: 'Pending' },
  { value: 'declined', label: 'Declined' },
];

const PHOTO_FILTERS: ReadonlyArray<{ value: PhotoFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'with_photo', label: 'With photo' },
  { value: 'photo_pending', label: 'Photo pending' },
];

function decisionLabel(status: ManagerAttendanceRecord['decisionStatus']): string {
  if (status === 'pending') return 'Decision pending';
  if (status === 'accepted') return 'Accepted Tag-Along';
  if (status === 'declined') return 'Tag-Along declined';
  return 'My meeting';
}

export default function ManagerTagAlongHistoryScreen() {
  const insets = useSafeAreaInsets();
  // 2026-08-19 (Vince direction): this screen is the Manager's RECORD of
  // tagged-along visits and the shortcut into each one, so it defaults to
  // 'combined' — `getManagerAttendanceHistory()` returns tag-along rows ONLY
  // under that scope ('mine' is own-agent meetings only, 'team' returns []),
  // so a 'mine' default would keep this page looking empty even after
  // B-119's sync-down fix lands. Deliberately LOCAL state rather than
  // `useManagerScope()`: that store is shared with Manager Home, Clients,
  // Maps and Meetings, and writing 'combined' into it here would silently
  // re-scope all of them too.
  const [scope, setScope] = useState<ManagerScope>('combined');
  const { records, loading, error, reload } = useManagerAttendanceHistory(scope);
  const [query, setQuery] = useState('');
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>('all');
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(() => records.filter((record) => {
    const hasPhoto = Boolean(record.selfieUrl || record.startPhotoUrl || record.endPhotoUrl);
    return (!normalized || (record.clientName ?? '').toLowerCase().includes(normalized))
      && (photoFilter === 'all' || (photoFilter === 'with_photo' ? hasPhoto : !hasPhoto))
      && (attendanceFilter === 'all' || record.decisionStatus === attendanceFilter);
  }), [records, normalized, photoFilter, attendanceFilter]);
  const { page, totalPages, pageItems, setPage } = usePagination(filtered, `${scope}:${normalized}:${photoFilter}:${attendanceFilter}`);
  const countFor = (status: AttendanceFilter) => status === 'all' ? records.length : records.filter((record) => record.decisionStatus === status).length;
  const filtersActive = scope !== 'combined' || photoFilter !== 'all' || attendanceFilter !== 'all';
  const scopeLabel = scope === 'combined' ? 'Combined' : 'My Records';
  const photoLabel = PHOTO_FILTERS.find((item) => item.value === photoFilter)?.label ?? 'All';
  const attendanceLabel = ATTENDANCE_FILTERS.find((item) => item.value === attendanceFilter)?.label ?? 'All records';

  /** Resets to this screen's own 'combined' baseline (see the scope state above), not the shared store's 'mine'. */
  function resetFilters(): void {
    setScope('combined');
    setPhotoFilter('all');
    setAttendanceFilter('all');
  }

  function renderOverviewOption(status: Exclude<AttendanceFilter, 'all'>, label: string): React.ReactNode {
    const count = countFor(status);
    const selected = attendanceFilter === status;
    return <Pressable key={status} accessibilityRole="button" accessibilityLabel={`Show ${label.toLowerCase()} records`} onPress={() => setAttendanceFilter(selected ? 'all' : status)} style={{ flex: 1, minWidth: 68, minHeight: 52, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: selected ? BIZLINK_COLORS.ink : BIZLINK_COLORS.soft, justifyContent: 'center' }}>
      <Text fontSize={17} fontFamily={BIZLINK_FONTS.semibold} color={selected ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.text}>{count}</Text>
      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={selected ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} numberOfLines={1}>{label}</Text>
    </Pressable>;
  }

  return <YStack flex={1} paddingTop={insets.top} backgroundColor={BIZLINK_COLORS.canvas}>
    <BizTopBar title="Tag-Along Attendance" fallbackHref="/(manager)" />
    <YStack paddingHorizontal="$4" gap="$3">
      <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} gap="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Attendance overview</Text>
          <Pressable onPress={() => setAttendanceFilter('all')} accessibilityRole="button" accessibilityLabel="Show all attendance records"><Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} color={attendanceFilter === 'all' ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted}>{countFor('all')} total</Text></Pressable>
        </XStack>
        <XStack height={8} borderRadius={99} overflow="hidden" backgroundColor={BIZLINK_COLORS.soft} gap={2}>
          {(['mine', 'accepted', 'pending', 'declined'] as const).map((status) => {
            const count = countFor(status);
            return count > 0 ? <Pressable key={status} onPress={() => setAttendanceFilter(status)} style={{ flex: count, backgroundColor: attendanceFilter === status ? BIZLINK_COLORS.ink : BIZLINK_COLORS.brand }} /> : null;
          })}
        </XStack>
        <XStack gap="$1.5" flexWrap="wrap">
          {renderOverviewOption('mine', 'My meetings')}
          {renderOverviewOption('accepted', 'Accepted')}
          {renderOverviewOption('pending', 'Pending')}
          {renderOverviewOption('declined', 'Declined')}
        </XStack>
      </YStack>
      <XStack height={52} alignItems="center" gap="$2">
        <XStack flex={1} height={52} alignItems="center" gap="$2" paddingHorizontal={12} backgroundColor={BIZLINK_COLORS.card} borderRadius={16} borderWidth={1} borderColor={BIZLINK_COLORS.line}>
          <Search size={17} color={BIZLINK_COLORS.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search company..." placeholderTextColor={BIZLINK_COLORS.muted} style={{ flex: 1, color: BIZLINK_COLORS.text, fontFamily: BIZLINK_FONTS.medium, fontSize: 13 }} />
        </XStack>
        <Pressable accessibilityRole="button" accessibilityLabel="Toggle attendance filters" onPress={() => setFilterOpen((open) => !open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, borderRadius: 16, paddingHorizontal: 14, backgroundColor: filterOpen || filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.card, borderWidth: 1, borderColor: filterOpen || filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.line }}>
          <SlidersHorizontal size={16} color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}>Filters</Text>
        </Pressable>
      </XStack>
    </YStack>
    <BizFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
      <BizFilterSheetRow label="Record scope" value={scopeLabel}>
        <XStack gap="$2" flexWrap="wrap"><BizChip label="My Records" selected={scope === 'mine'} onPress={() => setScope('mine')} /><BizChip label="Combined" selected={scope === 'combined'} onPress={() => setScope('combined')} /></XStack>
      </BizFilterSheetRow>
      <BizFilterSheetRow label="Photo status" value={photoLabel}>
        <XStack gap="$2" flexWrap="wrap">{PHOTO_FILTERS.map((filter) => <BizChip key={filter.value} label={filter.label} selected={photoFilter === filter.value} onPress={() => setPhotoFilter(filter.value)} />)}</XStack>
      </BizFilterSheetRow>
      <BizFilterSheetRow label="Attendance status" value={attendanceLabel}>
        <XStack gap="$2" flexWrap="wrap">{ATTENDANCE_FILTERS.map((filter) => <BizChip key={filter.value} label={filter.label} selected={attendanceFilter === filter.value} onPress={() => setAttendanceFilter(filter.value)} />)}</XStack>
      </BizFilterSheetRow>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$3">Combined only shows locally available canonical meetings while offline.</Text>
    </BizFilterSheet>
    {loading ? <YStack flex={1} alignItems="center" justifyContent="center"><Spinner size="large" color={BIZLINK_COLORS.brand} /></YStack>
      : error ? <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$5"><Text color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text><Pressable onPress={() => void reload()} style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: BIZLINK_COLORS.card, borderRadius: 12 }}><Text color={BIZLINK_COLORS.brand} fontFamily={BIZLINK_FONTS.semibold}>Try again</Text></Pressable></YStack>
        : <FlatList data={pageItems} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} />} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} renderItem={({ item }) => {
          const hasPhoto = Boolean(item.selfieUrl || item.startPhotoUrl || item.endPhotoUrl);
          return <Pressable onPress={() => router.push(`/(manager)/more/meetings/${item.id}`)} style={{ backgroundColor: BIZLINK_COLORS.card, borderRadius: 18, padding: 16, marginBottom: 10, minHeight: 88 }}>
            <XStack alignItems="center" gap="$2"><YStack flex={1}><Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{item.clientName ?? 'Unknown client'}</Text><Text fontSize={11.5} color={BIZLINK_COLORS.muted}>{new Date(item.loggedAt).toLocaleString()} · {decisionLabel(item.decisionStatus)}</Text><Text fontSize={10.5} color={BIZLINK_COLORS.muted}>{item.syncStatus === 'synced' ? (hasPhoto ? 'Synced' : 'Synced · photo unavailable') : 'Pending local sync · photo may be unavailable offline'}</Text></YStack><StatusBadge label={hasPhoto ? 'Photo' : 'Photo pending'} background={hasPhoto ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft} color={hasPhoto ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted} /><Camera size={17} color={BIZLINK_COLORS.muted} /></XStack>
          </Pressable>;
        }} ListEmptyComponent={<YStack alignItems="center" padding="$8"><Text color={BIZLINK_COLORS.muted}>No attendance records match these filters.</Text></YStack>} />}
    {filtered.length > 0 ? <BizFloatingPager page={page} totalPages={totalPages} onPageChange={setPage} bottomOffset={insets.bottom + 16} /> : null}
  </YStack>;
}
