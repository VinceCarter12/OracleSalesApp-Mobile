import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Button, Input, Label, Select, Spinner, Text, YStack } from 'tamagui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { CUSTOMER_TYPES, SALES_CHANNELS } from '../../../types';

export default function CreateClientScreen() {
  const { session } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [customerType, setCustomerType] = useState<string>(CUSTOMER_TYPES[0]);
  const [salesChannel, setSalesChannel] = useState<string>(SALES_CHANNELS[0]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!companyName.trim()) {
      Alert.alert('Validation', 'Company name is required.');
      return;
    }
    setLoading(true);

    // Duplicate check
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .ilike('company_name', companyName.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      setLoading(false);
      Alert.alert('Duplicate', 'A client with this company name already exists.');
      return;
    }

    const { error } = await supabase.from('clients').insert({
      company_name: companyName.trim(),
      contact_person: contactPerson.trim(),
      customer_type: customerType,
      sales_channel: salesChannel,
      agent_id: session?.user.id,
    });

    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <YStack flex={1} padding="$6" gap="$4" backgroundColor="$background">
        <Text fontSize="$6" fontWeight="700">New Client</Text>

        <YStack gap="$2">
          <Label>Company Name *</Label>
          <Input
            placeholder="Acme Corporation"
            value={companyName}
            onChangeText={setCompanyName}
            size="$4"
          />
        </YStack>

        <YStack gap="$2">
          <Label>Contact Person</Label>
          <Input
            placeholder="Juan Dela Cruz"
            value={contactPerson}
            onChangeText={setContactPerson}
            size="$4"
          />
        </YStack>

        <YStack gap="$2">
          <Label>Customer Type</Label>
          <Select value={customerType} onValueChange={setSalesChannel} disablePreventBodyScroll>
            <Select.Trigger size="$4">
              <Select.Value placeholder="Select type" />
            </Select.Trigger>
            <Select.Content>
              <Select.ScrollUpButton />
              <Select.Viewport>
                {CUSTOMER_TYPES.map((type, i) => (
                  <Select.Item key={type} index={i} value={type}>
                    <Select.ItemText>{type}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select>
        </YStack>

        <YStack gap="$2">
          <Label>Sales Channel</Label>
          <Select value={salesChannel} onValueChange={setSalesChannel} disablePreventBodyScroll>
            <Select.Trigger size="$4">
              <Select.Value placeholder="Select channel" />
            </Select.Trigger>
            <Select.Content>
              <Select.ScrollUpButton />
              <Select.Viewport>
                {SALES_CHANNELS.map((ch, i) => (
                  <Select.Item key={ch} index={i} value={ch}>
                    <Select.ItemText>{ch}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select>
        </YStack>

        <Button
          size="$4"
          marginTop="$4"
          onPress={handleSubmit}
          disabled={loading}
          theme="active"
          icon={loading ? <Spinner /> : undefined}
        >
          {loading ? 'Saving…' : 'Create Client'}
        </Button>
      </YStack>
    </ScrollView>
  );
}
