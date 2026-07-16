import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { useClients } from '../../../lib/useClients';
import { CLIENT_STATUS_BADGES, getClientStatus } from '../../../lib/client-status';
import { TopBar } from '../../../components/ui/TopBar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SelectTile } from '../../../components/ui/SelectTile';
import type { Client } from '../../../types';

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
  const badge = CLIENT_STATUS_BADGES[getClientStatus(client)];
  return (
    <Pressable onPress={() => openRecordFlow(client)}>
      <XStack
        paddingVertical={13}
        paddingHorizontal={4}
        justifyContent="space-between"
        alignItems="center"
        borderBottomWidth={2}
        borderBottomColor={COLORS.polar}
      >
        <YStack gap="$0.5" flex={1}>
          <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client.company_name}</Text>
          <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{client.contact_person || '—'}</Text>
        </YStack>
        <StatusBadge {...badge} />
      </XStack>
    </Pressable>
  );
}

export default function SelectClientScreen() {
  const insets = useSafeAreaInsets();
  const { clients, loading, refresh } = useClients();

  // Without this, a client created via Create Client (or completed via
  // Complete Info) never shows up here until a manual pull-to-refresh or app
  // restart — useClients() only fetches once on mount, and this screen can
  // stay mounted across navigations. clients/index.tsx already does this.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Record Meeting" />
      <YStack paddingHorizontal="$4" paddingBottom="$2" gap="$1">
        <Text fontSize={13} fontWeight="600" color={COLORS.hare}>
          Existing clients go straight to photo capture — no form to re-fill.
        </Text>
      </YStack>

      {loading && !clients.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={COLORS.feather} />
        </YStack>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => <ClientRow client={item} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
              <Text color={COLORS.hare}>No clients yet.</Text>
            </YStack>
          }
        />
      )}

      <YStack paddingHorizontal="$4" paddingBottom="$3" paddingTop="$2">
        <SelectTile
          label="First time meeting this client (meeting-first)"
          selected={false}
          onPress={() => router.push('/(tabs)/meetings/record')}
          fullWidth
          icon={<Sparkles size={14} color={COLORS.eel} />}
        />
        <Text fontSize={11.5} fontWeight="600" color={COLORS.hare} textAlign="center" marginTop="$2">
          Meeting-first clients are recorded as prospects automatically.
        </Text>
      </YStack>
    </YStack>
  );
}
