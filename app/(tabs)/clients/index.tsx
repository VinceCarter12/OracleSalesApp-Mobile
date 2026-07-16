import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { useClients } from '../../../lib/useClients';
import { CLIENT_STATUS_BADGES, getClientStatus } from '../../../lib/client-status';
import { LockButton } from '../../../components/security/LockButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SelectTile } from '../../../components/ui/SelectTile';
import { DuoButton } from '../../../components/ui/DuoButton';
import { CLIENT_STATUSES, type Client, type ClientStatus } from '../../../types';

type StatusFilter = ClientStatus | 'all';

function ClientRow({ client }: { client: Client }) {
  const badge = CLIENT_STATUS_BADGES[getClientStatus(client)];
  return (
    <Pressable onPress={() => router.push(`/(tabs)/clients/${client.id}`)}>
      <XStack
        alignItems="center"
        gap="$3"
        paddingVertical={13}
        paddingHorizontal={4}
        borderBottomWidth={2}
        borderBottomColor={COLORS.polar}
      >
        <YStack flex={1} gap="$0.5">
          <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client.company_name}</Text>
          <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
            {client.contact_person || 'Walang contact person pa'}
            {client.sales_channel ? ` · ${client.sales_channel}` : ''}
          </Text>
        </YStack>
        <StatusBadge {...badge} />
        <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
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
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>My Clients</Text>
        <XStack marginLeft="auto"><LockButton /></XStack>
      </XStack>

      <YStack paddingHorizontal="$4" gap="$2.5">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search company name…"
          placeholderTextColor={COLORS.hare}
          style={{
            height: 50,
            borderWidth: 2,
            borderColor: COLORS.swan,
            borderRadius: 12,
            paddingHorizontal: 14,
            fontWeight: '700',
            fontSize: 14.5,
            color: COLORS.eel,
            backgroundColor: COLORS.snow,
          }}
        />
        <XStack gap="$2" flexWrap="wrap">
          <SelectTile label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          {CLIENT_STATUSES.map((status) => (
            <SelectTile
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
          <Spinner size="large" color={COLORS.feather} />
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 }}
          renderItem={({ item }) => <ClientRow client={item} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8" gap="$2.5">
              <Building2 size={40} color={COLORS.hare} />
              <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center">
                {clients.length === 0 ? 'Wala ka pang clients.' : 'Walang tumugma sa filter.'}
              </Text>
            </YStack>
          }
        />
      )}

      <YStack paddingHorizontal="$4" paddingBottom="$3">
        <DuoButton label="+ New Client" onPress={() => router.push('/(tabs)/clients/create')} />
      </YStack>
    </YStack>
  );
}
