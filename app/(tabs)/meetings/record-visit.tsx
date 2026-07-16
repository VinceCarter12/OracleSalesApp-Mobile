import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Spinner, Text, YStack } from 'tamagui';
import { useAuth } from '../../../lib/useAuth';
import { useSession } from '../../../lib/session-store';
import { rowToClient, type LocalClientRow } from '../../../lib/local-client-mapper';
import { createMeeting, uploadMeetingPhoto } from '../../../lib/meeting-service';
import { captureGps } from '../../../lib/gps';
import { COLORS } from '../../../lib/theme';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { DuoButton } from '../../../components/ui/DuoButton';
import { ClientInfoCard } from '../../../components/clients/ClientInfoCard';
import { AgendaChecklist } from '../../../components/meetings/AgendaChecklist';
import { MeetingModeToggle } from '../../../components/meetings/MeetingModeToggle';
import { PhotoCapture, type CapturedPhoto } from '../../../components/meetings/PhotoCapture';
import type { Client, MeetingMode } from '../../../types';

interface StartCapture {
  capturedAt: string;
  gpsLat: number;
  gpsLng: number;
}

/**
 * Existing-client fast path (revises ADR-015, 2026-07-16): select client →
 * Start button (GPS + timestamp only, no photo) → meeting (agenda ticks) →
 * end photo (photo + GPS + timestamp, as before). No form re-fill — client
 * info is display-only. Admin (web) manually validates the meeting by
 * matching the Start GPS to the End photo's GPS; duration is computed
 * web-side from the two timestamps, never here.
 */
export default function RecordVisitScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { session } = useAuth();
  const { profileId } = useSession();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<MeetingMode>('in_person');
  const [starting, setStarting] = useState(false);
  const [start, setStart] = useState<StartCapture | null>(null);
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Local SQLite is the primary read path (ADR-001/T-003).
  useEffect(() => {
    if (!clientId) return;
    db.getFirstAsync<LocalClientRow>('SELECT * FROM clients WHERE id = ?', [clientId]).then((row) => {
      if (!row) Alert.alert('Error', 'Client not found.');
      else setClient(rowToClient(row));
      setLoading(false);
    });
  }, [db, clientId]);

  function toggleAgenda(agenda: string): void {
    setSelectedAgendas((prev) =>
      prev.includes(agenda) ? prev.filter((a) => a !== agenda) : [...prev, agenda]
    );
  }

  /** Starts the meeting: GPS + timestamp only, no photo (2026-07-16 revision). */
  async function startMeeting(): Promise<void> {
    setStarting(true);
    try {
      const gps = await captureGps();
      setStart({
        capturedAt: new Date().toISOString(),
        gpsLat: gps.lat,
        gpsLng: gps.lng,
      });
    } catch (err) {
      Alert.alert('Location Error', err instanceof Error ? err.message : 'Failed to get GPS location.');
    } finally {
      setStarting(false);
    }
  }

  async function finishMeeting(endPhoto: CapturedPhoto): Promise<void> {
    if (!start || !session || !profileId) return;
    setSaving(true);
    try {
      // Storage path convention keys by the Auth uid (matches Storage RLS'
      // `auth.uid()` check) — deliberately session.user.id, not profileId.
      const endUrl = await uploadMeetingPhoto(endPhoto.uri, session.user.id, 'end');
      await createMeeting({
        client_id: clientId ?? null,
        agent_id: profileId,
        gps_lat: start.gpsLat,
        gps_lng: start.gpsLng,
        meeting_mode: mode,
        agendas: selectedAgendas,
        outcome: null,
        start_captured_at: start.capturedAt,
        end_photo_url: endUrl,
        end_captured_at: endPhoto.capturedAt,
        end_gps_lat: endPhoto.gpsLat,
        end_gps_lng: endPhoto.gpsLng,
        logged_at: start.capturedAt,
      });
      router.replace('/(tabs)/meetings/celebrate');
    } catch (err) {
      console.error('[RecordVisit] Save Error:', JSON.stringify(err, null, 2));
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to save the meeting.';
      Alert.alert('Save Error', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Spinner size="large" color={COLORS.feather} />
      </YStack>
    );
  }

  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor={COLORS.snow} gap="$3">
        <Text>Client not found.</Text>
        <DuoButton label="Go back" variant="white" onPress={() => router.back()} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title={`Meeting — ${client.company_name}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <ClientInfoCard client={client} />

        {!start ? (
          <YStack marginTop="$4" gap="$4">
            <MeetingModeToggle mode={mode} onChange={setMode} />
            <DuoButton
              label={starting ? 'Capturing GPS…' : 'Start'}
              onPress={startMeeting}
              disabled={starting}
            />
            <Text fontSize={12} fontWeight="600" color={COLORS.hare} textAlign="center">
              Binds GPS + timestamp to the start of the meeting — no photo needed here anymore.
            </Text>
          </YStack>
        ) : (
          <YStack marginTop="$4" gap="$4">
            <Card style={{ backgroundColor: COLORS.greenTint, borderWidth: 0 }}>
              <Text fontWeight="800" fontSize={14} color={COLORS.ledgeGreen}>Meeting in progress</Text>
              <Text fontSize={12.5} fontWeight="600" color={COLORS.ledgeGreen} marginTop="$1">
                Started {new Date(start.capturedAt).toLocaleTimeString()} · GPS locked
              </Text>
            </Card>

            <SectionHeader title="Agenda" helper="· piliin lahat ng na-cover" />
            <Text fontSize={12} fontWeight="600" color={COLORS.hare} marginTop={-6} marginBottom="$2" lineHeight={17}>
              Ang "Product / company presentation" tick dito ang buong basehan ng progress % ng client — hindi na Complete Info (B-001).
            </Text>
            <AgendaChecklist selected={selectedAgendas} onToggle={toggleAgenda} />

            {saving ? (
              <YStack alignItems="center" gap="$2.5" padding="$4">
                <Spinner size="large" color={COLORS.feather} />
                <Text color={COLORS.hare}>Saving meeting…</Text>
              </YStack>
            ) : (
              <PhotoCapture
                label="End Photo"
                captureButtonLabel="Finish — take END photo"
                confirmButtonLabel="Confirm — end the meeting"
                onConfirm={finishMeeting}
              />
            )}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
