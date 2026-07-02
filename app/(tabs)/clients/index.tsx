import { useEffect, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { Button, Separator, Spinner, Text, XStack, YStack } from 'tamagui';
import { useClients } from '../../../lib/useClients';
import type { Client } from '../../../types';

function ClientRow({ client }: { client: Client }) {
  return (
    <Link href={`/(tabs)/clients/${client.id}`} asChild>
      <YStack padding="$4" gap="$1" pressStyle={{ opacity: 0.7 }}>
        <Text fontWeight="600" fontSize="$4">{client.company_name}</Text>
        <Text fontSize="$3" color="$colorPress">{client.contact_person}</Text>
        <Text fontSize="$2" color="$colorPress">{client.customer_type} · {client.sales_channel}</Text>
      </YStack>
    </Link>
  );
}

export default function ClientsScreen() {
  const { clients, loading, refresh } = useClients();

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack padding="$4" justifyContent="flex-end">
        <Link href="/(tabs)/clients/create" asChild>
          <Button size="$3" theme="active">+ New Client</Button>
        </Link>
      </XStack>

      {loading && !clients.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ClientRow client={item} />}
          ItemSeparatorComponent={() => <Separator />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
              <Text color="$colorPress">No clients yet. Tap "+ New Client" to add one.</Text>
            </YStack>
          }
        />
      )}
    </YStack>
  );
}
