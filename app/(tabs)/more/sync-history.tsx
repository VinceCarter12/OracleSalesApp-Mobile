import { useCallback, useMemo, useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { History } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { getSyncHistory, type SyncHistoryEntry, type SyncHistoryOutcome } from '../../../lib/sync-history';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizFilterScroll, type BizFilterOption } from '../../../components/bizlink/BizFilterScroll';
import { StatusBadge } from '../../../components/ui/StatusBadge';

function outcomeBadges(BIZLINK_COLORS: ReturnType<typeof useBizlinkColors>): Record<SyncHistoryOutcome, { label: string; background: string; color: string }> {
  return {
    synced: { label: 'Synced', background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.ink },
    conflict: { label: 'Conflict', background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.orange },
    failed: { label: 'Failed', background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red },
  };
}

const OUTCOME_FILTERS: BizFilterOption<'all' | SyncHistoryOutcome>[] = [
  { value: 'all', label: 'Lahat' },
  { value: 'synced', label: 'Synced' },
  { value: 'conflict', label: 'Conflict' },
  { value: 'failed', label: 'Failed' },
];

function createdOnlineLabel(createdOnline: boolean | null): string | null {
  if (createdOnline === null) return null;
  return createdOnline ? 'Ginawa habang online' : 'Ginawa habang offline';
}

function HistoryRow({ entry }: { entry: SyncHistoryEntry }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const badge = outcomeBadges(BIZLINK_COLORS)[entry.status];
  const createdLabel = createdOnlineLabel(entry.createdOnline);
  return (
    <YStack
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      padding={16}
      marginBottom={10}
      gap="$1"
    >
      <XStack alignItems="center" gap="$3">
        <YStack flex={1} gap="$0.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
            {entry.label}
          </Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {entry.status === 'synced' ? 'Na-upload noong ' : 'Huling sinubukan noong '}
            {new Date(entry.occurredAt).toLocaleString()}
          </Text>
          {createdLabel ? (
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {createdLabel} · {new Date(entry.createdAt).toLocaleString()}
            </Text>
          ) : null}
        </YStack>
        <StatusBadge {...badge} />
      </XStack>
      {entry.status === 'failed' && entry.lastError ? (
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} numberOfLines={2}>
          {entry.lastError}
        </Text>
      ) : null}
      {entry.adminMessage ? (
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.orange} marginTop="$0.5">
          {entry.adminMessage}
        </Text>
      ) : null}
    </YStack>
  );
}

/**
 * Wireframe `id="a-synchistory"` (`aRenderSyncHistory()`, ~line 1814) —
 * "Ano ang na-sync, kailan." Real `sync_audit_log` (Sprint.md T-016) is
 * remote-only and not yet applied to Supabase (see lib/sync/audit-log.ts),
 * so this reads the local `outbox` table's own terminal-state rows instead
 * (lib/sync-history.ts) — a genuinely real, never-pruned local record of
 * synced/conflict/failed outcomes, not mock data.
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
      if (outcomeFilter !== 'all' && entry.status !== outcomeFilter) return false;
      if (!query) return true;
      return (
        entry.label.toLowerCase().includes(query) ||
        entry.status.toLowerCase().includes(query) ||
        (entry.lastError ?? '').toLowerCase().includes(query)
      );
    });
  }, [entries, search, outcomeFilter]);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sync History" fallbackHref="/(tabs)/more" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2.5" lineHeight={18}>
          Listahan ng mga na-sync (o na-flag) na record galing sa device mo — pinaka-huli sa taas.
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search record or result..."
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
          <BizFilterScroll options={OUTCOME_FILTERS} value={outcomeFilter} onChange={setOutcomeFilter} />
        </YStack>
        {loading && entries.length === 0 ? (
          <YStack alignItems="center" padding="$8">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : filteredEntries.length === 0 ? (
          <YStack alignItems="center" padding="$8" gap="$2.5">
            <History size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {entries.length === 0 ? 'Wala pang sync history.' : 'Walang record na tumugma sa search/filter.'}
            </Text>
          </YStack>
        ) : (
          filteredEntries.map((entry) => <HistoryRow key={entry.id} entry={entry} />)
        )}
      </ScrollView>
    </YStack>
  );
}
