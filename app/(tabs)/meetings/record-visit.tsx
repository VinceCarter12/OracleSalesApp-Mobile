import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, YStack } from 'tamagui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { createMeeting, uploadMeetingPhoto } from '../../../lib/meeting-service';
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

/**
 * Existing-client fast path (ADR-015): select client → start photo → meeting
 * (agenda ticks) → end photo. No form re-fill — client info is display-only.
 * Duration is computed web-side from the two timestamps, never here.
 */
export default function RecordVisitScreen() {
  const insets = useSafeAreaInsets();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { session } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<MeetingMode>('in_person');
  const [startPhoto, setStartPhoto] = useState<CapturedPhoto | null>(null);
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
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
        else setClient(data);
        setLoading(false);
      });
  }, [clientId]);

  function toggleAgenda(agenda: string): void {
    setSelectedAgendas((prev) =>
      prev.includes(agenda) ? prev.filter((a) => a !== agenda) : [...prev, agenda]
    );
  }

  async function finishMeeting(endPhoto: CapturedPhoto): Promise<void> {
    if (!startPhoto || !session) return;
    setSaving(true);
    try {
      const startUrl = await uploadMeetingPhoto(startPhoto.uri, session.user.id, 'start');
      const endUrl = await uploadMeetingPhoto(endPhoto.uri, session.user.id, 'end');
      await createMeeting({
        client_id: clientId ?? null,
        agent_id: session.user.id,
        gps_lat: startPhoto.gpsLat,
        gps_lng: startPhoto.gpsLng,
        meeting_mode: mode,
        agendas: selectedAgendas,
        outcome: null,
        start_photo_url: startUrl,
        start_captured_at: startPhoto.capturedAt,
        end_photo_url: endUrl,
        end_captured_at: endPhoto.capturedAt,
        logged_at: startPhoto.capturedAt,
      });
      router.replace('/(tabs)/meetings/celebrate');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save the meeting.';
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

        {!startPhoto ? (
          <YStack marginTop="$4" gap="$4">
            <MeetingModeToggle mode={mode} onChange={setMode} />
            <PhotoCapture
              label="Start Photo"
              captureButtonLabel="Take START photo"
              confirmButtonLabel="Confirm — start the meeting"
              onConfirm={setStartPhoto}
            />
          </YStack>
        ) : (
          <YStack marginTop="$4" gap="$4">
            <Card style={{ backgroundColor: COLORS.greenTint, borderWidth: 0 }}>
              <Text fontWeight="800" fontSize={14} color={COLORS.ledgeGreen}>Meeting in progress</Text>
              <Text fontSize={12.5} fontWeight="600" color={COLORS.ledgeGreen} marginTop="$1">
                Started {new Date(startPhoto.capturedAt).toLocaleTimeString()} · start photo locked
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
