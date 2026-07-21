import { useEffect, useState } from 'react';
import { Alert, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { getClientById } from '../../../lib/client-service';
import { useAuth } from '../../../lib/useAuth';
import { useSession } from '../../../lib/session-store';
import { captureGps } from '../../../lib/gps';
import { checkConnectivity } from '../../../lib/sync/connectivity';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { createMeeting } from '../../../lib/meeting-service';
import { getTeamRoster, inviteeKindForRole } from '../../../lib/team-roster';
import { MAX_COMPANIONS_PER_REQUEST } from '../../../lib/tag-along-service';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizField } from '../../../components/bizlink/BizField';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
import { MeetingModeToggle } from '../../../components/meetings/MeetingModeToggle';
import { CompanionPicker } from '../../../components/meetings/CompanionPicker';
import { SelectedClientCard } from '../../../components/meetings/SelectedClientCard';
import { AutoCapturedPanel } from '../../../components/meetings/AutoCapturedPanel';
import { MeetingWrapUpSection } from '../../../components/meetings/MeetingWrapUpSection';
import { LostOpportunityDialog } from '../../../components/meetings/LostOpportunityDialog';
import { PhotoLightbox } from '../../../components/meetings/PhotoLightbox';
import { type MeetingMode, type MeetingOutcome, type TeamRosterEntry } from '../../../types';

const LOCATIONS = ['Client Office', 'Others'] as const;

export default function RecordMeetingScreen() {
  const insets = useSafeAreaInsets();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { session } = useAuth();
  const { profileId } = useSession();

  const [clientName, setClientName] = useState<string | null>(null);
  const [roster, setRoster] = useState<TeamRosterEntry[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<TeamRosterEntry[]>([]);

  const [mode, setMode] = useState<MeetingMode>('in_person');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selfiePreviewOpen, setSelfiePreviewOpen] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactPosition, setContactPosition] = useState('');
  const [meetingLocation, setMeetingLocation] = useState<(typeof LOCATIONS)[number]>('Client Office');
  const [otherLocation, setOtherLocation] = useState('');
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const [outcome, setOutcome] = useState<MeetingOutcome | null>(null);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    // Local SQLite is the primary read path (ADR-001) — a `pending`
    // (not-yet-synced) client only exists here.
    getClientById(clientId).then((client) => {
      if (!client) return;
      setClientName(client.company_name);
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

  async function captureLocation() {
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
    setSelectedAgendas((prev) =>
      prev.includes(agenda) ? prev.filter((a) => a !== agenda) : [...prev, agenda]
    );
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
      await createMeeting({
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
        locationType: meetingLocation,
        locationName: meetingLocation === 'Others' ? otherLocation : null,
        remarks: remarks || null,
        photoToQueue: { kind: 'selfie', localUri: photoUri, userId: session.user.id },
        companions: selectedCompanions.map((entry) => ({
          profileId: entry.profileId,
          kind: inviteeKindForRole(entry.role),
        })),
      });
      const connectivity = await checkConnectivity();
      router.replace(`/(tabs)/meetings/celebrate?online=${connectivity === 'online'}`);
    } catch (err) {
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
        <SelectedClientCard clientName={clientName} />

        <CompanionPicker roster={roster} selected={selectedCompanions} onToggle={toggleCompanion} />

        <MeetingModeToggle mode={mode} onChange={setMode} />

        <AutoCapturedPanel
          loadingLocation={loadingLocation}
          location={location}
          photoUri={photoUri}
          onOpenCamera={captureSelfie}
          onPreviewPress={() => setSelfiePreviewOpen(true)}
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
          {LOCATIONS.map((loc) => (
            <BizChip key={loc} label={loc} selected={meetingLocation === loc} onPress={() => setMeetingLocation(loc)} />
          ))}
        </XStack>
        {meetingLocation === 'Others' ? (
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
