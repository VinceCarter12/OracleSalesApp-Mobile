import { useEffect, useState } from 'react';
import { Alert, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AlertTriangle } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { getClientById } from '../../../lib/client-service';
import { useAuth } from '../../../lib/useAuth';
import { useSession } from '../../../lib/session-store';
import { captureGps } from '../../../lib/gps';
import { checkConnectivity } from '../../../lib/sync/connectivity';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { createMeeting } from '../../../lib/meeting-service';
import { AccountSuspendedError } from '../../../lib/app-lock/account-status';
import { getCompanionRosterForViewer, getTeamRoster, inviteeKindForRole } from '../../../lib/team-roster';
import { MAX_COMPANIONS_PER_REQUEST } from '../../../lib/tag-along-service';
import { useClientFlowRoutes } from '../../../lib/use-role-routes';
import { isInfoComplete } from '../../../lib/client-progress';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizField } from '../../../components/bizlink/BizField';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
import { CompanionPicker } from '../../../components/meetings/CompanionPicker';
import { SelectedClientCard } from '../../../components/meetings/SelectedClientCard';
import { AutoCapturedPanel } from '../../../components/meetings/AutoCapturedPanel';
import { MeetingWrapUpSection } from '../../../components/meetings/MeetingWrapUpSection';
import { LostOpportunityDialog } from '../../../components/meetings/LostOpportunityDialog';
import { PhotoLightbox } from '../../../components/meetings/PhotoLightbox';
import { ClientInfoCompletionNotice } from '../../../components/meetings/ClientInfoCompletionNotice';
import { PoEvidenceCard } from '../../../components/meetings/PoEvidenceCard';
import { isCloseDealPoEligible } from '../../../lib/policies/po-confirmation-status-policy';
import { CLOSE_DEAL_AGENDA, type Client, type MeetingMode, type MeetingOutcome, type TeamRosterEntry } from '../../../types';

// Wireframe-Sales-BizLink.html `id="a-record"` renders ONE "Meeting location"
// tile group (Client Office / Online / Others, `aSetMeetingLocation(kind,el)`)
// rather than a separate "Meeting mode" toggle plus a 2-tile location group.
// `aSetMeetingLocation` (wireframe line 1762) sets both the location kind AND
// derives meeting mode from it (`aSetMeetingMode(kind==='online'?'online':'in_person')`)
// — so this screen mirrors that single control instead of MeetingModeToggle's
// separate section (which stays correct for a-recordvisit, its own screen).
const LOCATION_TILES: Array<{ key: 'client_office' | 'online' | 'others'; label: string }> = [
  { key: 'client_office', label: 'Client Office' },
  { key: 'online', label: 'Online' },
  { key: 'others', label: 'Others' },
];
type LocationKind = (typeof LOCATION_TILES)[number]['key'];

export default function RecordMeetingScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { session } = useAuth();
  const { profileId, role, markSuspended } = useSession();
  const routes = useClientFlowRoutes();

  const [client, setClient] = useState<Client | null>(null);
  const [roster, setRoster] = useState<TeamRosterEntry[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<TeamRosterEntry[]>([]);

  const [mode, setMode] = useState<MeetingMode>('in_person');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selfiePreviewOpen, setSelfiePreviewOpen] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactPosition, setContactPosition] = useState('');
  const [locationKind, setLocationKind] = useState<LocationKind>('client_office');
  const [otherLocation, setOtherLocation] = useState('');
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const [outcome, setOutcome] = useState<MeetingOutcome | null>(null);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  // ADR-044/046 point 7: PO evidence for an In Progress client's 'Close
  // deal' agenda — capture-only here (camera, no gallery); the actual
  // capture/submit split happens in createMeeting() (lib/meeting-service.ts).
  const [poPhotoUri, setPoPhotoUri] = useState<string | null>(null);
  const [capturingPoPhoto, setCapturingPoPhoto] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    // Local SQLite is the primary read path (ADR-001) — a `pending`
    // (not-yet-synced) client only exists here.
    getClientById(clientId).then((client) => {
      if (!client) return;
      setClient(client);
      // ADR-030 Pass 2.5: prefill from the client's own contact info, kept
      // fully editable — the actual meeting contact can differ from the
      // client record's default.
      setContactName(client.contact_person ?? '');
      setContactPosition(client.position ?? '');
    });
  }, [clientId]);

  useEffect(() => {
    captureLocation();
  }, []);

  // ADR-030 Pass 2.5: local `team_roster_snapshot` mirror — empty when the
  // roster hasn't synced yet (or the agent has no team), in which case
  // CompanionPicker shows the offline helper and stays fully skippable.
  useEffect(() => {
    getTeamRoster().then(setRoster);
  }, []);

  // Wireframe `aSetMeetingLocation(kind,el)` (line 1762): one tap sets both
  // the location tile AND the underlying meeting mode.
  function selectLocation(kind: LocationKind): void {
    setLocationKind(kind);
    setMode(kind === 'online' ? 'online' : 'in_person');
  }

  function toggleCompanion(entry: TeamRosterEntry): void {
    setSelectedCompanions((prev) => {
      const alreadySelected = prev.some((p) => p.profileId === entry.profileId);
      if (alreadySelected) return prev.filter((p) => p.profileId !== entry.profileId);
      if (prev.length >= MAX_COMPANIONS_PER_REQUEST) {
        showToast('Hanggang 2 kasama lang ang pwede');
        return prev;
      }
      return [...prev, entry];
    });
  }

  async function captureLocation(): Promise<void> {
    setLoadingLocation(true);
    try {
      const gps = await captureGps();
      setLocation(gps);
    } catch (err) {
      Alert.alert('Location Error', err instanceof Error ? err.message : 'Failed to get GPS location.');
    } finally {
      setLoadingLocation(false);
    }
  }

  async function captureSelfie() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Camera permission is required for selfie capture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function toggleAgenda(agenda: string) {
    setSelectedAgendas((prev) => {
      const next = prev.includes(agenda) ? prev.filter((a) => a !== agenda) : [...prev, agenda];
      // Wireframe `aTogglePoEvidence()`: deselecting 'Close deal' clears any
      // already-attached PO photo, same as the demo's `aPoEvidenceConfirmed=false`.
      if (agenda === CLOSE_DEAL_AGENDA && !next.includes(CLOSE_DEAL_AGENDA)) setPoPhotoUri(null);
      return next;
    });
  }

  async function capturePoPhoto() {
    setCapturingPoPhoto(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Camera permission is required for PO evidence capture.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPoPhotoUri(result.assets[0].uri);
        showToast('PO evidence attached. Manager approval is still required.');
      }
    } finally {
      setCapturingPoPhoto(false);
    }
  }

  function selectOutcome(next: MeetingOutcome) {
    if (next === 'Lost Opportunity') {
      setLostDialogOpen(true);
      return;
    }
    setOutcome(next);
  }

  async function doSave() {
    if (!location) {
      Alert.alert('GPS Required', 'Wait for GPS location to be captured before saving.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Selfie Required', 'Please capture a selfie before saving.');
      return;
    }
    if (!outcome) {
      Alert.alert('Outcome Required', 'Please select a meeting outcome.');
      return;
    }
    if (poPhotoUri && client?.status === 'in_progress' && !client.cycle_id) {
      // ADR-044: po_confirmation_requests.cycle_id is NOT NULL — without a
      // synced-down cycle_id the request can't be submitted at all. Block
      // rather than silently drop the captured evidence.
      Alert.alert(
        'Sync Required',
        'This client’s current cycle hasn’t synced to this device yet. Sync online, then try again before saving with PO evidence.'
      );
      return;
    }
    if (!session || !profileId) {
      Alert.alert('Not signed in', 'Sign in again before recording a meeting.');
      return;
    }
    if (!clientId) {
      Alert.alert('Client Required', 'Select a client from the client picker before recording a meeting.');
      return;
    }

    setSaving(true);
    try {
      const resolvedClientId = clientId;

      // T-014 Phase C (ADR-026 P1 item 4): the photo is no longer uploaded
      // in the foreground at all — the meeting saves with the local
      // `file://` selfie URI immediately, and `createMeeting()` queues its
      // upload internally (`photoToQueue`) right after the local insert
      // commits. `meeting-service.ts`'s `remoteMediaUrl()` still nulls out
      // this local URI before it ever reaches the initial remote insert;
      // the queued upload's own patch (lib/sync/photo-uploads.ts) is what
      // sets the real Storage URL once it's actually uploaded. Storage path
      // convention keys by the Auth uid (matches Storage RLS' `auth.uid()`
      // check) — deliberately session.user.id, not profileId.
      const meetingId = await createMeeting({
        client_id: resolvedClientId,
        agent_id: profileId,
        gps_lat: location.lat,
        gps_lng: location.lng,
        meeting_mode: mode,
        selfie_url: photoUri,
        agendas: selectedAgendas,
        outcome,
        logged_at: new Date().toISOString(),
        contactPerson: contactName || null,
        contactPosition: contactPosition || null,
        // Remote `location_type` only distinguishes 'Client Office' vs
        // 'Others' (lib/remote-meeting-mapping.ts::toRemoteLocationType) —
        // an Online meeting maps to 'Others' here, same convention as
        // record-visit.tsx's B-085 fix, so it's never silently stored as a
        // client-site visit.
        locationType: locationKind === 'client_office' ? 'Client Office' : 'Others',
        locationName: locationKind === 'others' ? otherLocation : null,
        remarks: remarks || null,
        photoToQueue: { kind: 'selfie', localUri: photoUri, userId: session.user.id },
        companions: selectedCompanions.map((entry) => ({
          profileId: entry.profileId,
          kind: inviteeKindForRole(entry.role),
        })),
        // F-205 decision 2: a manager requesting companions on their OWN
        // meeting has no counterpart to approve it (they'd be approving
        // themselves) — those rows insert pre-accepted instead of pending.
        // Role-based (not route-based) so this stays correct regardless of
        // which route group renders this shared screen.
        companionsPreAccepted: role === 'sales_manager',
        // ADR-046 point 2 / Wireframe-Sales-BizLink.html:2152 (`poRequestPending`):
        // a Successful outcome is required alongside 'in_progress' + Close deal —
        // see lib/policies/po-confirmation-status-policy.ts::isCloseDealPoEligible.
        poEvidence:
          poPhotoUri && client?.cycle_id && isCloseDealPoEligible(client?.status, outcome, selectedAgendas)
            ? { localPhotoUri: poPhotoUri, cycleId: client.cycle_id, userId: session.user.id }
            : null,
        // Office Location Spec (2026-07-29): only an in-person 'Client
        // Office' meeting auto-captures the permanent office pin; Online and
        // Others must never touch it (agent may set it explicitly instead,
        // via Client Detail's Set/Update Office Location).
        captureOfficePin: mode === 'in_person' && locationKind === 'client_office',
      });
      const connectivity = await checkConnectivity();
      router.replace(routes.celebrate(connectivity === 'online', meetingId));
    } catch (err) {
      if (err instanceof AccountSuspendedError) {
        // Batch 5 Slice 2 (ADR-051): route to AccountSuspendedScreen instead
        // of showing a generic save error — never swallow this silently.
        markSuspended();
        return;
      }
      // PostgrestError isn't an Error instance — log the raw object (code/
      // details/hint) so on-device debugging isn't limited to err.message.
      console.error('[RecordMeeting] Save Error:', JSON.stringify(err, null, 2));
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to save the meeting.';
      Alert.alert('Save Error', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Record Meeting" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <SelectedClientCard clientName={client?.company_name ?? null} />
        {client && !isInfoComplete(client) ? (
          <ClientInfoCompletionNotice onCompleteInfo={() => router.push(routes.completeInfo(client.id))} />
        ) : null}

        <CompanionPicker
          roster={getCompanionRosterForViewer(roster, role)}
          selected={selectedCompanions}
          onToggle={toggleCompanion}
        />

        <AutoCapturedPanel
          loadingLocation={loadingLocation}
          location={location}
          photoUri={photoUri}
          onOpenCamera={captureSelfie}
          onPreviewPress={() => setSelfiePreviewOpen(true)}
          onRetryLocation={captureLocation}
        />

        <BizSectionHeader title="Actual contact person" />
        <BizField label="Name" value={contactName} onChangeText={setContactName} placeholder="Name" />
        <BizField
          label="Position"
          value={contactPosition}
          onChangeText={setContactPosition}
          placeholder="Position (Purchasing / CEO / Owner…)"
        />

        <BizSectionHeader title="Meeting location" />
        <XStack gap="$2" flexWrap="wrap">
          {LOCATION_TILES.map((tile) => (
            <BizChip
              key={tile.key}
              label={tile.label}
              selected={locationKind === tile.key}
              onPress={() => selectLocation(tile.key)}
            />
          ))}
        </XStack>
        {locationKind === 'online' ? (
          <XStack gap="$1.5" alignItems="flex-start" marginTop="$1.5">
            <AlertTriangle size={13} color={BIZLINK_COLORS.orange} strokeWidth={1.75} style={{ marginTop: 2 }} />
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} flex={1} lineHeight={16}>
              Online meeting — ang GPS na makukuha ay sa lokasyon MO, hindi sa client. Hindi ito bibilangin bilang
              client-site visit sa maps/reports.
            </Text>
          </XStack>
        ) : null}
        {locationKind === 'others' ? (
          <YStack marginTop="$2">
            <TextInput
              value={otherLocation}
              onChangeText={setOtherLocation}
              placeholder="e.g. Starbucks Alabang"
              placeholderTextColor={BIZLINK_COLORS.muted}
              style={{
                height: 52,
                borderRadius: 16,
                paddingHorizontal: 16,
                fontFamily: BIZLINK_FONTS.medium,
                fontSize: 14.5,
                color: BIZLINK_COLORS.text,
                backgroundColor: BIZLINK_COLORS.card,
                borderWidth: 1,
                borderColor: BIZLINK_COLORS.line,
              }}
            />
          </YStack>
        ) : null}

        <MeetingWrapUpSection
          selectedAgendas={selectedAgendas}
          onToggleAgenda={toggleAgenda}
          remarks={remarks}
          onRemarksChange={setRemarks}
          outcome={outcome}
          onSelectOutcome={selectOutcome}
          afterAgenda={
            <PoEvidenceCard
              // Wireframe-Sales-BizLink.html:701's `aTogglePoEvidence(this)` gates
              // the card's visibility purely on the Close-deal tile's own
              // selection state (agenda tiles render ABOVE Outcome in both the
              // wireframe and MeetingWrapUpSection's layout) — outcome is only
              // read later, in the `poRequestPending` calc at line 2152, which
              // gates the actual PO *submission*, not this card's visibility.
              // Gating `visible` on outcome too would show/hide this card based
              // on a field the agent hasn't reached yet in the scroll order,
              // which is a real UX regression, not just a cosmetic deviation —
              // see isCloseDealPoEligible's use in the poEvidence trigger below
              // for where the outcome check actually belongs.
              visible={client?.status === 'in_progress' && selectedAgendas.includes(CLOSE_DEAL_AGENDA)}
              photoUri={poPhotoUri}
              capturing={capturingPoPhoto}
              onCapture={capturePoPhoto}
            />
          }
        />

        <YStack marginTop="$5">
          <BizButton label={saving ? 'Saving…' : 'Save Meeting'} onPress={doSave} disabled={saving} />
        </YStack>
        <XStack justifyContent="center" marginTop="$2.5">
          {saving ? <Spinner color={BIZLINK_COLORS.brand} /> : null}
        </XStack>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$2">
          Gagana kahit walang signal — mase-save locally, auto-sync mamaya.
        </Text>
      </ScrollView>

      <LostOpportunityDialog
        visible={lostDialogOpen}
        onCancel={() => setLostDialogOpen(false)}
        onConfirm={() => {
          setOutcome('Lost Opportunity');
          setLostDialogOpen(false);
        }}
      />

      <PhotoLightbox uri={photoUri} visible={selfiePreviewOpen} onClose={() => setSelfiePreviewOpen(false)} />
    </YStack>
  );
}
