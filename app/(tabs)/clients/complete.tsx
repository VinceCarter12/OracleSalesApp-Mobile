import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import { getClientById, ClientUpdateConflictError } from '../../../lib/client-service';
import { getPendingEditRequestForClient, ClientNotFoundLocallyError, type ClientEditRequest } from '../../../lib/client-edit-request-service';
import { submitCompleteInfo, splitCompleteInfoChanges } from '../../../lib/complete-info-submit';
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
import { DeclareLostOpportunityAction } from '../../../components/bizlink/DeclareLostOpportunityAction';
import { CompleteInfoReadOnlyHeader } from '../../../components/bizlink/CompleteInfoReadOnlyHeader';
import { KeyboardAwareScrollView } from '../../../components/ui/KeyboardAwareScrollView';
import { SALES_CHANNELS, type Client, type SalesChannel } from '../../../types';
import {
  CONTACT_NUMBER_MAX_LENGTH,
  CONTACT_NUMBER_INVALID_MESSAGE,
  CONTACT_PERSON_MAX_LENGTH,
  POSITION_MAX_LENGTH,
  OFFICE_ADDRESS_MAX_LENGTH,
  MINOR_NOTES_MAX_LENGTH,
  isValidContactNumber,
  sanitizeContactNumber,
} from '../../../lib/field-validation';

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
  const { profileId, role, teamId, markSuspended } = useSession();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ClientEditRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactPerson, setContactPerson] = useState('');
  const [position, setPosition] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  // B-0xx fix (2026-08-09): no pre-selected fallback — was defaulting to
  // 'Distributor' so an agent could submit without ever actually choosing a
  // channel. Null until tapped; required before submit (see canSubmit below).
  const [channel, setChannel] = useState<SalesChannel | null>(null);
  const [existingOverride, setExistingOverride] = useState(false);
  const [minorNotes, setMinorNotes] = useState('');
  const [saving, setSaving] = useState(false);
  // 2026-08-09 (field validation): the 09-format hint only appears after the
  // user leaves the field or tries to save — never mid-typing.
  const [contactNumberTouched, setContactNumberTouched] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([getClientById(clientId), getPendingEditRequestForClient(clientId)]).then(([foundClient, pending]) => {
      if (!foundClient) {
        Alert.alert('Error', 'Client not found.');
      } else {
        setClient(foundClient);
        setPendingRequest(pending);
        setContactPerson(foundClient.contact_person ?? '');
        setPosition(foundClient.position ?? '');
        setContactNumber(foundClient.contact_number ?? '');
        setOfficeAddress(foundClient.office_address ?? '');
        setChannel(foundClient.sales_channel ?? null);
        setExistingOverride(foundClient.status === 'existing');
        setMinorNotes(foundClient.minor_notes ?? '');
      }
      setLoading(false);
    });
  }, [clientId]);

  if (loading || !client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        {loading ? <Spinner size="large" color={BIZLINK_COLORS.brand} /> : <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Client not found.</Text>}
      </YStack>
    );
  }

  // Cosmetic only (BizTopBar title toggle) — "has the checklist ever been
  // fully filled," independent of the per-field approval gating below.
  const firstTime = !isInfoComplete(client);
  const isManagerOwnClient = role === 'sales_manager' && client.agent_id === profileId;
  // Vince's locked decision (2026-08-11): the owning agent of any role, which
  // already includes a sales_manager on a client they directly own (the same
  // `isManagerOwnClient` carve-out edits above use — `client.agent_id ===
  // profileId` is a superset). Manager stays read-only for every other
  // agent's client. No local lost/deleted check is possible here: mobile's
  // ClientStatus domain (types/index.ts CLIENT_STATUSES) has no 'lost'
  // value — a lost client is deleted from local SQLite entirely on
  // sync-down (ADR-026 P1, lib/sync/entity-appliers.ts::
  // removeLostOrDeletedClient), so any client this screen can even load is,
  // by construction, never already lost.
  const canDeclareLost = client.agent_id === profileId;

  // Per-field approval gating (2026-08-11, fixes B-10x): recomputed live from
  // current form state on every render, using the exact same split
  // submitCompleteInfo() applies at save time (lib/complete-info-submit.ts)
  // — one definition of "does this change need approval," shared by the
  // live UI and the write path. `channel === null` (not yet chosen) can't
  // be diffed yet — canSubmit already blocks save in that state.
  const approvalRequiredFields: string[] =
    channel === null
      ? []
      : splitCompleteInfoChanges(client, { contactPerson, position, contactNumber, officeAddress, channel, existingOverride, minorNotes })
          .approvalRequiredFields;
  const needsApproval = approvalRequiredFields.length > 0 && !isManagerOwnClient;

  // Contact number is OPTIONAL (blank allowed), but when provided it must be
  // a valid 11-digit 09-format Philippine mobile number (lib/field-validation).
  const contactNumberValid = contactNumber.trim() === '' || isValidContactNumber(contactNumber.trim());

  async function handleSubmit(): Promise<void> {
    if (!profileId || !clientId || !client) return;
    if (channel === null) {
      Alert.alert('Error', 'Pick the sales channel before saving.');
      return;
    }
    if (!contactNumberValid) {
      setContactNumberTouched(true);
      Alert.alert('Error', CONTACT_NUMBER_INVALID_MESSAGE);
      return;
    }

    setSaving(true);
    try {
      const branch = await submitCompleteInfo({
        client,
        clientId,
        profileId,
        pendingRequest,
        isManagerOwnClient,
        form: { contactPerson, position, contactNumber, officeAddress, channel, existingOverride, minorNotes },
      });

      if (branch === 'blocked_pending') return;

      const TOASTS: Record<Exclude<Awaited<ReturnType<typeof submitCompleteInfo>>, 'blocked_pending'>, string> = {
        direct_first_time: '✓ Info completed — applied right away',
        direct_manager_owns: '✓ Info updated — applied right away',
        direct_exempt_only: '✓ Notes saved — applied right away',
        request_approval: "Submitted for your manager's approval",
      };
      showToast(TOASTS[branch]);
      router.back();
    } catch (err) {
      if (err instanceof AccountSuspendedError) {
        // Batch 5 Slice 2 (ADR-051): route to AccountSuspendedScreen instead
        // of showing a generic save error — never swallow this silently.
        markSuspended();
      } else if (err instanceof ClientUpdateConflictError) {
        Alert.alert('Client changed', err.message);
      } else if (err instanceof ClientNotFoundLocallyError) {
        Alert.alert('Error', 'Client not yet synced to this device — try again once online.');
      } else {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save.');
      }
    } finally {
      setSaving(false);
    }
  }


  const canSubmit = !saving && pendingRequest === null && channel !== null && contactNumberValid;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={firstTime ? 'Complete Info' : 'Edit Info'} />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3.5" lineHeight={19}>
          {needsApproval ? (
            <>
              Some info here was already saved —{' '}
              <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>changing it needs your Sales Manager's approval</Text>{' '}
              before it becomes final. Fields that are still blank apply right away.
            </>
          ) : firstTime ? (
            <>
              Complete these blank details —{' '}
              <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>they take effect immediately</Text>, no approval
              needed (this is part of creating the client, not an edit).
            </>
          ) : isManagerOwnClient ? (
            <>
              This is your client record —{' '}
              <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>your changes take effect immediately</Text>.
              {' '}No approval is needed.
            </>
          ) : (
            <>
              This client's info is complete —{' '}
              <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>changes here are sent for approval</Text>{' '}
              by your Sales Manager before they become final.
            </>
          )}
        </Text>

        {pendingRequest ? (
          <YStack marginBottom="$3.5">
            <BizPendingBanner since={pendingRequest.createdAt} />
          </YStack>
        ) : null}

        {/* Company name + city are set once at Create Client (Phase A) and
            are view-only here — not part of the wireframe's a-complete form,
            and editing them isn't in scope for info completion. */}
        <CompleteInfoReadOnlyHeader companyName={client.company_name} city={client.city} />
        <BizField
          label="CONTACT PERSON"
          value={contactPerson}
          onChangeText={setContactPerson}
          placeholder="Full name"
          maxLength={CONTACT_PERSON_MAX_LENGTH}
        />
        <BizField
          label="POSITION (the decision-maker only: purchasing/CEO/owner)"
          value={position}
          onChangeText={setPosition}
          placeholder="e.g. Purchasing Manager"
          maxLength={POSITION_MAX_LENGTH}
        />
        <BizField
          label="CONTACT NUMBER"
          value={contactNumber}
          onChangeText={(text) => {
            setContactNumber(sanitizeContactNumber(text));
            setContactNumberTouched(false);
          }}
          onBlur={() => setContactNumberTouched(true)}
          placeholder="09xx xxx xxxx"
          keyboardType="phone-pad"
          maxLength={CONTACT_NUMBER_MAX_LENGTH}
          hint={
            contactNumberTouched && !contactNumberValid ? (
              <Text
                fontSize={11.5}
                fontFamily={BIZLINK_FONTS.semibold}
                backgroundColor={BIZLINK_COLORS.tintB}
                color={BIZLINK_COLORS.red}
                borderRadius={14}
                paddingHorizontal={13}
                paddingVertical={9}
              >
                {CONTACT_NUMBER_INVALID_MESSAGE}
              </Text>
            ) : null
          }
        />
        <BizField
          label="OFFICE ADDRESS"
          value={officeAddress}
          onChangeText={setOfficeAddress}
          placeholder="Complete address"
          maxLength={OFFICE_ADDRESS_MAX_LENGTH}
        />

        <BizSectionHeader title="Client status" />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2" lineHeight={17}>
          All new clients start as Prospect. The status automatically updates after a validated meeting.
        </Text>
        <XStack gap="$2" alignItems="center">
          <BizChip label="Existing client" selected={existingOverride} onPress={() => setExistingOverride((prev) => !prev)} />
          {canDeclareLost ? (
            <DeclareLostOpportunityAction
              clientId={client.id}
              profileId={profileId}
              teamId={teamId}
              onSuspended={markSuspended}
              onDeclared={() => router.back()}
              inline
            />
          ) : null}
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
          maxLength={MINOR_NOTES_MAX_LENGTH}
        />

        <YStack marginTop="$5">
          <BizButton
            label={saving ? 'Saving…' : !needsApproval ? 'Save info' : 'Submit for approval'}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
        </YStack>
      </KeyboardAwareScrollView>
    </YStack>
  );
}
