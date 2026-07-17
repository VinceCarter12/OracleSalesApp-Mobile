import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useClients } from '../../../lib/useClients';
import { CLIENT_STATUS_BADGES, getClientStatus } from '../../../lib/client-status';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { BizChip } from '../../../components/bizlink/BizChip';
import type { Client, ClientStatus } from '../../../types';

// Record-picker status filter (Wireframe-Sales-BizLink.html #a-record,
// aRecordPickerFilter/aRenderRecordPicker) — defaults to 'existing' per the
// wireframe. Pure UI filter/hint over the already-loaded client list; routing
// logic (openRecordFlow) is untouched.
type RecordPickerFilter = ClientStatus | 'all';
const RECORD_PICKER_FILTERS: Array<{ value: RecordPickerFilter; label: string }> = [
  { value: 'existing', label: 'Existing' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'new', label: 'New' },
  { value: 'all', label: 'All' },
];

/**
 * Record Meeting entry point (ADR-015). The branch happens HERE, at client
 * selection — customer type is derived from the record, never asked:
 *   existing        → photo-only fast path (record-visit)
 *   prospect / new  → full form (record)
 *   meeting-first   → full form with no client preselected (stays prospect)
 */
function openRecordFlow(client: Client): void {
  const status = getClientStatus(client);
  if (status === 'existing') {
    router.push(`/(tabs)/meetings/record-visit?clientId=${client.id}`);
  } else {
    router.push(`/(tabs)/meetings/record?clientId=${client.id}`);
  }
}

function ClientRow({ client }: { client: Client }) {
  const status = getClientStatus(client);
  const badge = CLIENT_STATUS_BADGES[status];
  // "Log Visit lang" (existing = photo-only fast path) vs "Full form"
  // (prospect/new) — mirrors openRecordFlow's own branch, display-only.
  const hint = status === 'existing' ? 'Log Visit lang' : 'Full form';
  return (
    <Pressable onPress={() => openRecordFlow(client)}>
      <XStack
        alignItems="center"
        justifyContent="space-between"
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={16}
        marginBottom={10}
      >
        <YStack gap="$0.5" flex={1}>
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.company_name}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{hint}</Text>
        </YStack>
        <StatusBadge {...badge} />
      </XStack>
    </Pressable>
  );
}

export default function SelectClientScreen() {
  const insets = useSafeAreaInsets();
  const { clients, loading, refresh } = useClients();
  const [statusFilter, setStatusFilter] = useState<RecordPickerFilter>('existing');

  // Without this, a client created via Create Client (or completed via
  // Complete Info) never shows up here until a manual pull-to-refresh or app
  // restart — useClients() only fetches once on mount, and this screen can
  // stay mounted across navigations.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = useMemo(
    () => (statusFilter === 'all' ? clients : clients.filter((c) => getClientStatus(c) === statusFilter)),
    [clients, statusFilter]
  );

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Record Meeting" />
      <YStack paddingHorizontal="$4" paddingBottom="$2" gap="$1">
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          Existing clients go straight to photo capture — no form to re-fill.
        </Text>
      </YStack>

      <XStack paddingHorizontal="$4" gap="$2" flexWrap="wrap" marginBottom="$2.5">
        {RECORD_PICKER_FILTERS.map((f) => (
          <BizChip
            key={f.value}
            label={f.label}
            selected={statusFilter === f.value}
            onPress={() => setStatusFilter(f.value)}
          />
        ))}
      </XStack>

      {loading && !clients.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => <ClientRow client={item} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
              <Text color={BIZLINK_COLORS.muted}>
                {clients.length === 0 ? 'No clients yet.' : 'Walang client dito.'}
              </Text>
            </YStack>
          }
        />
      )}

      <YStack paddingHorizontal="$4" paddingBottom="$3" paddingTop="$2">
        <BizChip
          label="First time meeting this client (meeting-first)"
          selected={false}
          onPress={() => router.push('/(tabs)/meetings/record')}
          fullWidth
          icon={<Sparkles size={14} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />}
        />
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$2">
          Meeting-first clients are recorded as prospects automatically.
        </Text>
      </YStack>
    </YStack>
  );
}
