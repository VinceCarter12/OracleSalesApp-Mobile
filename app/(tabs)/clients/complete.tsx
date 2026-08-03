import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import { getClientById, checkCompanyNameDuplicate, DuplicateCompanyNameError } from '../../../lib/client-service';
import { getPendingEditRequestForClient, ClientNotFoundLocallyError, type ClientEditRequest } from '../../../lib/client-edit-request-service';
import { submitCompleteInfo } from '../../../lib/complete-info-submit';
import { AccountSuspendedError } from '../../../lib/app-lock/account-status';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { isInfoComplete } from '../../../lib/client-progress';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizField } from '../../../components/bizlink/BizField';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizPendingBanner } from '../../../components/bizlink/BizPendingBanner';
import { SALES_CHANNELS, type Client, type SalesChannel } from '../../../types';

type DupState = 'idle' | 'checking' | 'duplicate' | 'available';

/**
 * Complete Info (Wireframe a-complete, F-001 Phase B / F-002): first-time
 * completion applies directly; edits after completion branch per ADR-052
 * section F — see lib/complete-info-branch.ts for the exact, load-bearing
 * order (pending guard → firstTime → exempt-only → manager-owns → request).
 *
 * Local SQLite is the primary read/write path (ADR-001/T-003) — a `pending`
 * (not-yet-synced) client only ever exists here until the outbox pushes it,
 * same as clients/[id].tsx.
 */
export default function CompleteInfoScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { profileId, role, markSuspended } = useSession();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ClientEditRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [dupState, setDupState] = useState<DupState>('idle');
  const [contactPerson, setContactPerson] = useState('');
  const [position, setPosition] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [channel, setChannel] = useState<SalesChannel>('Distributor');
  const [existingOverride, setExistingOverride] = useState(false);
  const [minorNotes, setMinorNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([getClientById(clientId), getPendingEditRequestForClient(clientId)]).then(([foundClient, pending]) => {
      if (!foundClient) {
        Alert.alert('Error', 'Client not found.');
      } else {
        setClient(foundClient);
        setPendingRequest(pending);
        setCompanyName(foundClient.company_name);
        setContactPerson(foundClient.contact_person ?? '');
        setPosition(foundClient.position ?? '');
        setContactNumber(foundClient.contact_number ?? '');
        setOfficeAddress(foundClient.office_address ?? '');
        setChannel(foundClient.sales_channel ?? 'Distributor');
        setExistingOverride(foundClient.status === 'existing');
        setMinorNotes(foundClient.minor_notes ?? '');
      }
      setLoading(false);
    });
  }, [clientId]);

  // Live duplicate-name hint — same debounced local-then-live pattern as
  // app/(tabs)/clients/create.tsx, scoped to this client's own city and
  // excluding itself (so an unchanged name never self-flags).
  useEffect(() => {
    if (!client) return;
    const name = companyName.trim();
    if (!name) {
      setDupState('idle');
      return;
    }
    setDupState('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkCompanyNameDuplicate(name, client.city ?? null, client.id);
      if (!cancelled) setDupState(result === 'duplicate' ? 'duplicate' : 'available');
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyName, client]);

  if (loading || !client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        {loading ? <Spinner size="large" color={BIZLINK_COLORS.brand} /> : <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Client not found.</Text>}
      </YStack>
    );
  }

  const firstTime = !isInfoComplete(client);
  const isManagerOwnClient = role === 'sales_manager' && client.agent_id === profileId;

  async function handleSubmit(): Promise<void> {
    if (!profileId || !clientId || !client) return;
    if (dupState === 'duplicate') {
      Alert.alert('Duplicate', `A client named "${companyName.trim()}" already exists in this city.`);
      return;
    }

    setSaving(true);
    try {
      const branch = await submitCompleteInfo({
        client,
        clientId,
        profileId,
        pendingRequest,
        firstTime,
        isManagerOwnClient,
        form: { companyName, contactPerson, position, contactNumber, officeAddress, channel, existingOverride, minorNotes },
      });

      if (branch === 'blocked_pending') return;

      const TOASTS: Record<Exclude<Awaited<ReturnType<typeof submitCompleteInfo>>, 'blocked_pending'>, string> = {
        direct_first_time: '✓ Nakumpleto ang info — direktang na-apply',
        direct_manager_owns: '✓ Na-update ang info — direktang na-apply',
        direct_exempt_only: '✓ Na-save ang notes — direktang na-apply',
        request_approval: 'Naisumite para sa approval ng manager',
      };
      showToast(TOASTS[branch]);
      router.back();
    } catch (err) {
      if (err instanceof AccountSuspendedError) {
        // Batch 5 Slice 2 (ADR-051): route to AccountSuspendedScreen instead
        // of showing a generic save error — never swallow this silently.
        markSuspended();
      } else if (err instanceof DuplicateCompanyNameError) {
        setDupState('duplicate');
        Alert.alert('Duplicate', err.message);
      } else if (err instanceof ClientNotFoundLocallyError) {
        Alert.alert('Error', 'Client not yet synced to this device — try again once online.');
      } else {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save.');
      }
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !saving && dupState !== 'duplicate' && pendingRequest === null;

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

        {pendingRequest ? (
          <YStack marginBottom="$3.5">
            <BizPendingBanner since={pendingRequest.createdAt} />
          </YStack>
        ) : null}

        <BizField
          label="COMPANY NAME"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="e.g. Oracle Petroleum"
          hint={
            dupState === 'duplicate' ? (
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} backgroundColor={BIZLINK_COLORS.tintB} color={BIZLINK_COLORS.red} borderRadius={14} paddingHorizontal={13} paddingVertical={9}>
                May client nang ganitong pangalan sa city na ito — bawal ang duplicate.
              </Text>
            ) : dupState === 'available' && companyName.trim() !== client.company_name ? (
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} backgroundColor={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} borderRadius={14} paddingHorizontal={13} paddingVertical={9}>
                ✓ Available ang pangalang ito.
              </Text>
            ) : null
          }
        />
        <BizField label="CONTACT PERSON" value={contactPerson} onChangeText={setContactPerson} placeholder="Full name" />
        <BizField
          label="POSITION (decision-maker lang: purchasing/CEO/owner)"
          value={position}
          onChangeText={setPosition}
          placeholder="e.g. Purchasing Manager"
        />
        <BizField
          label="CONTACT NUMBER"
          value={contactNumber}
          onChangeText={setContactNumber}
          placeholder="09xx xxx xxxx"
          keyboardType="phone-pad"
        />
        <BizField
          label="OFFICE ADDRESS"
          value={officeAddress}
          onChangeText={setOfficeAddress}
          placeholder="Complete address"
        />

        <BizSectionHeader title="Client status" />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2" lineHeight={17}>
          Lahat ng bagong client ay Prospect. Awtomatikong magbabago ang status matapos ang validated meeting.
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label="Existing client" selected={existingOverride} onPress={() => setExistingOverride((prev) => !prev)} />
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

        <BizField
          label="Notes (optional)"
          value={minorNotes}
          onChangeText={setMinorNotes}
          placeholder="Internal notes — no approval needed"
          multiline
        />

        <YStack marginTop="$5">
          <BizButton
            label={saving ? 'Saving…' : firstTime || isManagerOwnClient ? 'Save info' : 'Submit for approval'}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
