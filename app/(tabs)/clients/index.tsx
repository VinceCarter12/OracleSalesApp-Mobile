import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Building2, Plus } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useClients } from '../../../lib/useClients';
import { CLIENT_STATUS_BADGES, getClientStatus } from '../../../lib/client-status';
import { BizLockButton } from '../../../components/bizlink/BizLockButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { BizChip } from '../../../components/bizlink/BizChip';
import { CLIENT_STATUSES, type Client, type ClientStatus } from '../../../types';

// NOTE: SyncBadge (per-record sync-state pill) was NOT added to these rows —
// `Client`/`Meeting` domain types (types/index.ts) have no `sync_status`
// field, and sync state only lives in the `outbox` table keyed by entity id.
// No lookup function exists to join outbox status onto a list row today
// (lib/sync-engine.ts only exposes aggregate getOutboxCounts()). Wiring this
// would be new data-plumbing, out of scope for a visual-only pass — flagged
// in the Phase 2 handoff report instead of invented here.

type StatusFilter = ClientStatus | 'all';

function ClientRow({ client }: { client: Client }) {
  const badge = CLIENT_STATUS_BADGES[getClientStatus(client)];
  return (
    <Pressable onPress={() => router.push(`/(tabs)/clients/${client.id}`)}>
      <XStack
        alignItems="center"
        gap="$3"
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={16}
        marginBottom={10}
      >
        <YStack flex={1} gap="$0.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.company_name}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {client.contact_person || 'Walang contact person pa'}
            {client.sales_channel ? ` · ${client.sales_channel}` : ''}
          </Text>
        </YStack>
        <StatusBadge {...badge} />
        <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
      </XStack>
    </Pressable>
  );
}

export default function ClientsScreen() {
  const insets = useSafeAreaInsets();
  const { clients, loading, refresh } = useClients();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  // Refreshes on every return to this screen — e.g. right after Create
  // Client saves locally (client-service.ts), so the new row shows up
  // without needing a manual pull-to-refresh.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter !== 'all' && getClientStatus(c) !== filter) return false;
      if (query && !c.company_name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [clients, search, filter]);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={26} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>My Clients</Text>
        <XStack marginLeft="auto" gap="$2" alignItems="center">
          <Pressable
            onPress={() => router.push('/(tabs)/clients/create')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: BIZLINK_COLORS.brand,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 10,
              minHeight: 44,
            }}
          >
            <Plus size={14} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>Create a Client</Text>
          </Pressable>
          <BizLockButton />
        </XStack>
      </XStack>

      <YStack paddingHorizontal="$4" gap="$2.5">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search company name…"
          placeholderTextColor={BIZLINK_COLORS.muted}
          style={{
            height: 52,
            borderRadius: 16,
            paddingHorizontal: 16,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            backgroundColor: BIZLINK_COLORS.card,
          }}
        />
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          {CLIENT_STATUSES.map((status) => (
            <BizChip
              key={status}
              label={CLIENT_STATUS_BADGES[status].label}
              selected={filter === status}
              onPress={() => setFilter(status)}
            />
          ))}
        </XStack>
      </YStack>

      {loading && !clients.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12 }}
          renderItem={({ item }) => <ClientRow client={item} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8" gap="$2.5">
              <Building2 size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
                {clients.length === 0 ? 'Wala ka pang clients.' : 'Walang tumugma sa filter.'}
              </Text>
            </YStack>
          }
        />
      )}
    </YStack>
  );
}
