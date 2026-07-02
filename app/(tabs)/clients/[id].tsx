import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, Separator, Spinner, Text, XStack, YStack } from 'tamagui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import type { Client } from '../../../types';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) Alert.alert('Error', error.message);
        else setClient(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
        <Text>Client not found.</Text>
      </YStack>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <YStack flex={1} padding="$6" gap="$4" backgroundColor="$background">
        <Text fontSize="$7" fontWeight="700">{client.company_name}</Text>

        <Separator />

        <YStack gap="$1">
          <Text fontSize="$3" color="$colorPress">Contact Person</Text>
          <Text fontSize="$4">{client.contact_person || '—'}</Text>
        </YStack>
        <YStack gap="$1">
          <Text fontSize="$3" color="$colorPress">Customer Type</Text>
          <Text fontSize="$4">{client.customer_type}</Text>
        </YStack>
        <YStack gap="$1">
          <Text fontSize="$3" color="$colorPress">Sales Channel</Text>
          <Text fontSize="$4">{client.sales_channel}</Text>
        </YStack>
        <YStack gap="$1">
          <Text fontSize="$3" color="$colorPress">Added</Text>
          <Text fontSize="$4">{new Date(client.created_at).toLocaleDateString()}</Text>
        </YStack>

        <Separator />

        <Button
          size="$4"
          theme="active"
          onPress={() => router.push(`/(tabs)/meetings/record?clientId=${client.id}`)}
        >
          Record Meeting
        </Button>
      </YStack>
    </ScrollView>
  );
}
