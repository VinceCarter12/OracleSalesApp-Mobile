import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import { rowToClient, type LocalClientRow } from '../../../lib/local-client-mapper';
import { updateClientInfo } from '../../../lib/client-service';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { isInfoComplete } from '../../../lib/client-progress';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizField } from '../../../components/bizlink/BizField';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { SALES_CHANNELS, type Client, type ClientStatus, type SalesChannel } from '../../../types';

// Wireframe a-complete's "Customer type" segmented control (~line 540) —
// New/Prospect/Existing, in that display order. Binds to mobile's local
// lifecycle `status` field (ClientStatus), NOT the legacy `customer_type`
// field (unused — see lib/remote-client-mapping.ts). 'inactive' is
// server-side lifecycle only and never offered here.
const CUSTOMER_TYPE_OPTIONS: readonly ClientStatus[] = ['new', 'prospect', 'existing'];
const CUSTOMER_TYPE_LABELS: Record<ClientStatus, string> = {
  new: 'New',
  prospect: 'Prospect',
  existing: 'Existing',
  inactive: 'Inactive',
};

/**
 * Complete Info (Wireframe a-complete, F-001 Phase B / F-002): first-time
 * completion applies directly; edits AFTER completion need manager approval
 * (approval flow itself is T-006 — for now edits save with a notice).
 *
 * Local SQLite is the primary read/write path (ADR-001/T-003) — a `pending`
 * (not-yet-synced) client only ever exists here until the outbox pushes it,
 * same as clients/[id].tsx.
 */
export default function CompleteInfoScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { profileId } = useSession();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactPerson, setContactPerson] = useState('');
  const [position, setPosition] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [channel, setChannel] = useState<SalesChannel>('Distributor');
  const [customerType, setCustomerType] = useState<ClientStatus>('prospect');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    db.getFirstAsync<LocalClientRow>('SELECT * FROM clients WHERE id = ?', [clientId]).then((row) => {
      if (!row) {
        Alert.alert('Error', 'Client not found.');
      } else {
        const mapped = rowToClient(row);
        setClient(mapped);
        setContactPerson(mapped.contact_person ?? '');
        setPosition(mapped.position ?? '');
        setContactNumber(mapped.contact_number ?? '');
        setOfficeAddress(mapped.office_address ?? '');
        setChannel(mapped.sales_channel ?? 'Distributor');
        setCustomerType(mapped.status ?? 'prospect');
      }
      setLoading(false);
    });
  }, [db, clientId]);

  if (loading || !client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        {loading ? <Spinner size="large" color={BIZLINK_COLORS.brand} /> : <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Client not found.</Text>}
      </YStack>
    );
  }

  const firstTime = !isInfoComplete(client);

  async function handleSubmit(): Promise<void> {
    if (!profileId || !clientId) return;
    setSaving(true);
    try {
      await updateClientInfo({
        clientId,
        agentId: profileId,
        contactPerson,
        position,
        contactNumber,
        officeAddress,
        salesChannel: channel,
        status: customerType,
      });
      showToast(
        firstTime
          ? '✓ Nakumpleto ang info — direktang na-apply'
          : 'Naisumite — approval flow (T-006) ang bahala sa susunod'
      );
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={firstTime ? 'Complete Info' : 'Edit Info'} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3.5" lineHeight={19}>
          {firstTime ? (
            <>
              Kumpletuhin ang blangkong info na ito —{' '}
              <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>direktang mag-a-apply</Text>, walang approval
              na kailangan (Phase B ng creation, hindi ito edit).
            </>
          ) : (
            <>
              Kumpleto na ang info ng client na ito — ang mga{' '}
              <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>pagbabago dito ay isusumite para sa approval</Text>{' '}
              ng iyong Sales Manager bago maging final.
            </>
          )}
        </Text>

        <BizField label="Contact Person" value={contactPerson} onChangeText={setContactPerson} placeholder="Full name" />
        <BizField
          label="Position (decision-maker lang)"
          value={position}
          onChangeText={setPosition}
          placeholder="e.g. Purchasing Manager"
        />
        <BizField
          label="Contact Number"
          value={contactNumber}
          onChangeText={setContactNumber}
          placeholder="09xx xxx xxxx"
          keyboardType="phone-pad"
        />
        <BizField
          label="Office Address"
          value={officeAddress}
          onChangeText={setOfficeAddress}
          placeholder="Complete address"
        />

        <BizSectionHeader title="Customer type" />
        <XStack gap="$2" flexWrap="wrap">
          {CUSTOMER_TYPE_OPTIONS.map((option) => (
            <BizChip
              key={option}
              label={CUSTOMER_TYPE_LABELS[option]}
              selected={customerType === option}
              onPress={() => setCustomerType(option)}
            />
          ))}
        </XStack>

        <BizSectionHeader title="Sales channel" />
        <XStack gap="$2" flexWrap="wrap">
          {SALES_CHANNELS.map((option) => (
            <BizChip
              key={option}
              label={option}
              selected={channel === option}
              onPress={() => setChannel(option)}
            />
          ))}
        </XStack>

        <YStack marginTop="$5">
          <BizButton
            label={saving ? 'Saving…' : firstTime ? 'Save Info' : 'Submit for Approval'}
            onPress={handleSubmit}
            disabled={saving}
          />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
