import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, Sparkles, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { rowToClient, type LocalClientRow } from '../../../lib/local-client-mapper';
import { useAuth } from '../../../lib/useAuth';
import { useSession } from '../../../lib/session-store';
import { captureGps } from '../../../lib/gps';
import { BIZLINK_COLORS, BIZLINK_ON_INK, BIZLINK_FONTS } from '../../../lib/theme';
import { createMeeting, uploadMeetingPhoto } from '../../../lib/meeting-service';
import { createClient } from '../../../lib/client-service';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizField } from '../../../components/bizlink/BizField';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
import { MeetingModeToggle } from '../../../components/meetings/MeetingModeToggle';
import { LostOpportunityDialog } from '../../../components/meetings/LostOpportunityDialog';
import {
  CLIENT_STATUSES,
  MEETING_AGENDAS,
  type ClientStatus,
  type MeetingMode,
  type MeetingOutcome,
} from '../../../types';

const LOCATIONS = ['Client Office', 'Others'] as const;

export default function RecordMeetingScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { session } = useAuth();
  const { profileId } = useSession();

  const [clientName, setClientName] = useState<string | null>(null);
  const [meetingFirst, setMeetingFirst] = useState(!clientId);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCity, setNewCompanyCity] = useState('');
  const [tagAlong, setTagAlong] = useState(false);

  const [mode, setMode] = useState<MeetingMode>('in_person');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactPosition, setContactPosition] = useState('');
  const [customerType, setCustomerType] = useState<ClientStatus>('prospect');
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
    db.getFirstAsync<LocalClientRow>('SELECT * FROM clients WHERE id = ?', [clientId]).then((row) => {
      if (row) setClientName(rowToClient(row).company_name);
    });
  }, [db, clientId]);

  useEffect(() => {
    captureLocation();
  }, []);

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
    if (meetingFirst && !newCompanyName.trim()) {
      Alert.alert('Company name required', 'Enter the company name for this first meeting.');
      return;
    }
    if (meetingFirst && !newCompanyCity.trim()) {
      Alert.alert('City required', 'Enter the company\'s city for this first meeting.');
      return;
    }

    setSaving(true);
    try {
      let resolvedClientId = clientId ?? null;

      // Meeting-first exception (Rule 4): the info captured here becomes the
      // client record automatically. Goes through the same offline-first
      // dup-check + local write + outbox enqueue as Create Client (T-005).
      if (meetingFirst) {
        resolvedClientId = await createClient({
          companyName: newCompanyName,
          city: newCompanyCity,
          agentId: profileId,
          contactPerson: contactName,
          position: contactPosition.trim() || null,
        });
      }

      // Storage path convention keys by the Auth uid (matches Storage RLS'
      // `auth.uid()` check) — deliberately session.user.id, not profileId.
      const photoUrl = await uploadMeetingPhoto(photoUri, session.user.id, 'selfie');
      await createMeeting({
        client_id: resolvedClientId,
        agent_id: profileId,
        gps_lat: location.lat,
        gps_lng: location.lng,
        meeting_mode: mode,
        selfie_url: photoUrl,
        agendas: selectedAgendas,
        outcome,
        logged_at: new Date().toISOString(),
        contactPerson: contactName || null,
        contactPosition: contactPosition || null,
        locationType: meetingLocation,
        locationName: meetingLocation === 'Others' ? otherLocation : null,
        remarks: remarks || null,
      });
      router.replace('/(tabs)/meetings/celebrate');
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
        <YStack gap="$2.5" marginBottom="$3.5">
          <BizChip
            label="Unang beses ko makausap ang client na ito (meeting-first)"
            selected={meetingFirst}
            onPress={() => setMeetingFirst((v) => !v)}
            fullWidth
            icon={<Sparkles size={14} color={meetingFirst ? BIZLINK_COLORS.card : BIZLINK_COLORS.muted} strokeWidth={1.75} />}
          />
          <BizChip
            label="May kasama akong manager ngayon (tag-along)"
            selected={tagAlong}
            onPress={() => setTagAlong((v) => !v)}
            fullWidth
            icon={<Users size={14} color={tagAlong ? BIZLINK_COLORS.card : BIZLINK_COLORS.muted} strokeWidth={1.75} />}
          />
        </YStack>

        {tagAlong ? (
          <YStack backgroundColor={BIZLINK_COLORS.tintA} borderRadius={20} padding={14} marginBottom="$3.5">
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.ink} lineHeight={17}>
              Siguraduhing makikita ang manager sa meeting photo — ito ang proof niya na sumama siya.
              Ikaw pa rin ang magre-record; siya na lang ang mag-a-approve pagkatapos.
            </Text>
          </YStack>
        ) : null}

        {meetingFirst ? (
          <YStack marginBottom="$2">
            <BizField
              label="New Company Name"
              value={newCompanyName}
              onChangeText={setNewCompanyName}
              placeholder="Company name"
            />
            <BizField
              label="City"
              value={newCompanyCity}
              onChangeText={setNewCompanyCity}
              placeholder="e.g. Cabanatuan"
            />
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$-2" marginBottom="$2">
              Ang info na makukuha mo dito ay awtomatikong magiging client record (Rule 4 — meeting-first exception).
            </Text>
          </YStack>
        ) : (
          <>
            <BizSectionHeader title="Company" />
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text} marginBottom="$3.5">
              {clientName ?? '—'}
            </Text>
          </>
        )}

        <MeetingModeToggle mode={mode} onChange={setMode} />

        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.5} marginTop="$4" marginBottom="$1">
          Auto-captured
        </Text>
        <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16} gap="$2.5">
          <XStack alignItems="center" gap="$2">
            <Check size={14} color="#8FD7B4" strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>GPS</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
              {loadingLocation
                ? 'Capturing…'
                : location
                  ? `${location.lat.toFixed(4)}° N, ${location.lng.toFixed(4)}° E (at capture)`
                  : 'Not captured'}
            </Text>
          </XStack>
          <XStack alignItems="center" gap="$2">
            <Check size={14} color="#8FD7B4" strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>Date & time</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>{new Date().toLocaleString()}</Text>
          </XStack>
          <XStack alignItems="center" gap="$3">
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: 56, height: 56, borderRadius: 16 }} />
            ) : (
              <YStack width={56} height={56} borderRadius={16} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
                <Camera size={20} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
              </YStack>
            )}
            <YStack flex={1}>
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>Selfie — camera only</Text>
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Compressed ≤3MB · naka-save locally</Text>
              <YStack marginTop="$1.5">
                <BizButton small label={photoUri ? 'Retake' : 'Open Camera'} variant="white" onPress={captureSelfie} />
              </YStack>
            </YStack>
          </XStack>
        </YStack>

        <BizSectionHeader title="Actual contact person" />
        <BizField label="Name" value={contactName} onChangeText={setContactName} placeholder="Name" />
        <BizField
          label="Position"
          value={contactPosition}
          onChangeText={setContactPosition}
          placeholder="Position (Purchasing / CEO / Owner…)"
        />

        <BizSectionHeader title="Customer type" />
        <XStack gap="$2" flexWrap="wrap">
          {CLIENT_STATUSES.map((status) => (
            <BizChip
              key={status}
              label={status.charAt(0).toUpperCase() + status.slice(1)}
              selected={customerType === status}
              onPress={() => setCustomerType(status)}
            />
          ))}
        </XStack>

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
                backgroundColor: BIZLINK_COLORS.canvas,
              }}
            />
          </YStack>
        ) : null}

        <BizSectionHeader title="Agenda" helper="· piliin lahat" />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2" lineHeight={17}>
          Ang "Product / company presentation" tick dito ang buong basehan ng progress % ng client — hindi na Complete Info (B-001).
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {MEETING_AGENDAS.map((agenda) => (
            <BizChip
              key={agenda}
              label={agenda}
              selected={selectedAgendas.includes(agenda)}
              onPress={() => toggleAgenda(agenda)}
            />
          ))}
        </XStack>

        <BizSectionHeader title="Remarks" />
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Notes / comments…"
          placeholderTextColor={BIZLINK_COLORS.muted}
          multiline
          style={{
            height: 74,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            backgroundColor: BIZLINK_COLORS.canvas,
            textAlignVertical: 'top',
          }}
        />

        <BizSectionHeader title="Meeting outcome *" />
        <XStack gap="$2" flexWrap="wrap">
          <BizChip label="✓ Successful" tone="ok" selected={outcome === 'Successful'} onPress={() => selectOutcome('Successful')} />
          <BizChip label="Follow-up required" selected={outcome === 'Follow-up Required'} onPress={() => selectOutcome('Follow-up Required')} />
          <BizChip label="No decision" selected={outcome === 'No Decision'} onPress={() => selectOutcome('No Decision')} />
          <BizChip label="Lost opportunity" tone="lost" selected={outcome === 'Lost Opportunity'} onPress={() => selectOutcome('Lost Opportunity')} />
        </XStack>

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
    </YStack>
  );
}
