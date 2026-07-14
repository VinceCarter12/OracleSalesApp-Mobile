import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { supabase } from '../../../lib/supabase';
import { COLORS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { isInfoComplete } from '../../../lib/client-progress';
import { TopBar } from '../../../components/ui/TopBar';
import { Field } from '../../../components/ui/Field';
import { SelectTile } from '../../../components/ui/SelectTile';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { DuoButton } from '../../../components/ui/DuoButton';
import { SALES_CHANNELS, type Client, type SalesChannel } from '../../../types';

/**
 * Complete Info (Wireframe a-complete, F-001 Phase B / F-002): first-time
 * completion applies directly; edits AFTER completion need manager approval
 * (approval flow itself is T-006 — for now edits save with a notice).
 */
export default function CompleteInfoScreen() {
  const insets = useSafeAreaInsets();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactPerson, setContactPerson] = useState('');
  const [position, setPosition] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [channel, setChannel] = useState<SalesChannel>('Distributor');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()
      .then(({ data, error }) => {
        if (error) Alert.alert('Error', error.message);
        else if (data) {
          setClient(data);
          setContactPerson(data.contact_person ?? '');
          setPosition(data.position ?? '');
          setContactNumber(data.contact_number ?? '');
          setOfficeAddress(data.office_address ?? '');
          if (data.sales_channel) setChannel(data.sales_channel);
        }
        setLoading(false);
      });
  }, [clientId]);

  if (loading || !client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        {loading ? <Spinner size="large" color={COLORS.feather} /> : <Text>Client not found.</Text>}
      </YStack>
    );
  }

  const firstTime = !isInfoComplete(client);

  async function handleSubmit(): Promise<void> {
    setSaving(true);
    const { error } = await supabase
      .from('clients')
      .update({
        contact_person: contactPerson.trim(),
        position: position.trim(),
        contact_number: contactNumber.trim(),
        office_address: officeAddress.trim(),
        sales_channel: channel,
      })
      .eq('id', clientId);
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      showToast(
        firstTime
          ? '✓ Nakumpleto ang info — direktang na-apply'
          : 'Naisumite — approval flow (T-006) ang bahala sa susunod'
      );
      router.back();
    }
  }

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title={firstTime ? 'Complete Info' : 'Edit Info'} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3.5" lineHeight={19}>
          {firstTime ? (
            <>
              Kumpletuhin ang blangkong info na ito —{' '}
              <Text fontWeight="800" color={COLORS.eel}>direktang mag-a-apply</Text>, walang approval
              na kailangan (Phase B ng creation, hindi ito edit).
            </>
          ) : (
            <>
              Kumpleto na ang info ng client na ito — ang mga{' '}
              <Text fontWeight="800" color={COLORS.eel}>pagbabago dito ay isusumite para sa approval</Text>{' '}
              ng iyong Sales Manager bago maging final.
            </>
          )}
        </Text>

        <Field label="Contact Person" value={contactPerson} onChangeText={setContactPerson} placeholder="Full name" />
        <Field
          label="Position (decision-maker lang)"
          value={position}
          onChangeText={setPosition}
          placeholder="e.g. Purchasing Manager"
        />
        <Field
          label="Contact Number"
          value={contactNumber}
          onChangeText={setContactNumber}
          placeholder="09xx xxx xxxx"
          keyboardType="phone-pad"
        />
        <Field
          label="Office Address"
          value={officeAddress}
          onChangeText={setOfficeAddress}
          placeholder="Complete address"
        />

        <SectionHeader title="Sales channel" />
        <XStack gap="$2" flexWrap="wrap">
          {SALES_CHANNELS.map((option) => (
            <SelectTile
              key={option}
              label={option}
              selected={channel === option}
              onPress={() => setChannel(option)}
            />
          ))}
        </XStack>

        <YStack marginTop="$5">
          <DuoButton
            label={saving ? 'Saving…' : firstTime ? 'Save Info' : 'Submit for Approval'}
            onPress={handleSubmit}
            disabled={saving}
          />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
