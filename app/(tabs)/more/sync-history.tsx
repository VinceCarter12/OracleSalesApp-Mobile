import { useCallback, useMemo, useState } from 'react';
import { ScrollView, TextInput, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Search, Check, AlertTriangle, RotateCcw, ChevronRight } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { getSyncHistory, type SyncHistoryEntry, type SyncHistoryOutcome } from '../../../lib/sync-history';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFilterScroll, type BizFilterOption } from '../../../components/bizlink/BizFilterScroll';

const OUTCOME_FILTERS: BizFilterOption<'all' | SyncHistoryOutcome>[] = [
  { value: 'all', label: 'All' },
  { value: 'synced', label: 'Synced' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'retried', label: 'Retried' },
];

// Map internal status to display status matching wireframe
function getDisplayStatus(entry: SyncHistoryEntry): string {
  if (entry.status === 'synced') return 'synced';
  if (entry.status === 'conflict' && entry.retryCount > 0) return 'resolved';
  if (entry.status === 'failed' && entry.retryCount > 0) return 'retried';
  return entry.status;
}

function getStatusIcon(entry: SyncHistoryEntry) {
  const status = getDisplayStatus(entry);
  if (status === 'synced') return Check;
  if (status === 'resolved') return AlertTriangle;
  if (status === 'retried') return RotateCcw;
  return AlertTriangle;
}

/**
 * Wireframe `id="a-synchistory"` (`aRenderSyncHistory()`, ~line 1814) —
 * 2026-08-05 redesign matching Screenshots 1 & 2: numbered list items,
 * status icons, tap card to navigate to detail screen, search + filter chips.
 */
export default function SyncHistoryScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const [entries, setEntries] = useState<SyncHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | SyncHistoryOutcome>('all');

  const load = useCallback(() => {
    setLoading(true);
    getSyncHistory()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const displayStatus = getDisplayStatus(entry);
      // Map 'resolved' and 'retried' back to their internal types for filtering
      if (outcomeFilter === 'resolved' && displayStatus !== 'resolved') return false;
      if (outcomeFilter === 'retried' && displayStatus !== 'retried') return false;
      if (outcomeFilter !== 'all' && outcomeFilter !== 'resolved' && outcomeFilter !== 'retried' && entry.status !== outcomeFilter) return false;
      
      if (!query) return true;
      return (
        entry.label.toLowerCase().includes(query) ||
        displayStatus.toLowerCase().includes(query) ||
        (entry.lastError ?? '').toLowerCase().includes(query)
      );
    });
  }, [entries, search, outcomeFilter]);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sync History" fallbackHref="/(tabs)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={18}>
          Listahan ng mga na-syno (o na-flag) na record galing sa device mo — pinaka-huli sa taas.
        </Text>

        {/* Search Bar */}
        <XStack alignItems="center" gap="$2" height={52} paddingHorizontal={16} backgroundColor={BIZLINK_COLORS.card} borderRadius={16} marginBottom="$3">
          <Search size={17} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search record or result..."
            placeholderTextColor={BIZLINK_COLORS.muted}
            style={{
              flex: 1,
              fontFamily: BIZLINK_FONTS.medium,
              fontSize: 14,
              color: BIZLINK_COLORS.text,
            }}
          />
        </XStack>

        {/* Filter Chips */}
        <YStack marginBottom="$3">
          <BizFilterScroll options={OUTCOME_FILTERS} value={outcomeFilter as any} onChange={(v) => setOutcomeFilter(v as any)} />
        </YStack>

        {/* Sync History List */}
        {loading && entries.length === 0 ? (
          <YStack alignItems="center" padding="$8">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : filteredEntries.length === 0 ? (
          <YStack alignItems="center" padding="$8" gap="$2.5">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {entries.length === 0 ? 'Wala pang sync history.' : 'Walang record na tumugma sa search/filter.'}
            </Text>
          </YStack>
        ) : (
          filteredEntries.map((entry, index) => {
            const StatusIcon = getStatusIcon(entry);
            const displayStatus = getDisplayStatus(entry);
            
            return (
              <Pressable
                key={entry.id}
                onPress={() => router.push({
                  pathname: '/(tabs)/more/sync-record/[id]',
                  params: { id: entry.id }
                })}
                style={{ marginBottom: 12 }}
              >
                <XStack
                  backgroundColor={BIZLINK_COLORS.card}
                  borderRadius={20}
                  padding={16}
                  alignItems="center"
                  gap="$3"
                  pressStyle={{ opacity: 0.7 }}
                >
                  {/* Number Badge */}
                  <View
                    width={32}
                    height={32}
                    borderRadius={16}
                    backgroundColor={BIZLINK_COLORS.soft}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                      {index + 1}
                    </Text>
                  </View>

                  {/* Status Icon */}
                  <StatusIcon size={18} color={
                    displayStatus === 'synced' ? BIZLINK_COLORS.brand :
                    displayStatus === 'resolved' ? BIZLINK_COLORS.orange :
                    BIZLINK_COLORS.muted
                  } strokeWidth={2} />

                  {/* Content */}
                  <YStack flex={1} gap="$0.5">
                    <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
                      {entry.label}
                    </Text>
                    <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                      {entry.status === 'synced' ? 'Uploaded from this device' : 
                       entry.status === 'conflict' ? 'Conflict resolved: renamed' :
                       entry.status === 'failed' && entry.retryCount > 0 ? `Na-fail muna, successful sa ${entry.retryCount === 1 ? '2nd' : entry.retryCount + 1}nd retry` :
                       'Processing'} · {new Date(entry.occurredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                  </YStack>

                  {/* Chevron */}
                  <ChevronRight size={18} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
                </XStack>
              </Pressable>
            );
          })
        )}

        {/* Pagination (if needed) */}
        {filteredEntries.length > 0 && (
          <XStack alignItems="center" justifyContent="center" gap="$3" marginTop="$4">
            <View
              width={40}
              height={40}
              borderRadius={20}
              backgroundColor={BIZLINK_COLORS.ink}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color="#FFFFFF">
                1
              </Text>
            </View>
          </XStack>
        )}
      </ScrollView>
    </YStack>
  );
}
