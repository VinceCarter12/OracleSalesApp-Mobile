import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MapPin } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { rowToMeeting, type LocalMeetingRow } from '../../../lib/local-meeting-mapper';
import { COLORS, OUTCOME_BADGE_STYLES } from '../../../lib/theme';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { Meeting } from '../../../types';

/**
 * Local SQLite is the primary read path (ADR-001/T-004) — a meeting only
 * ever exists here until the outbox pushes it. This used to read a single
 * row directly from Supabase via `.single()`, which threw "Cannot coerce the
 * result to a single JSON object" for any meeting not yet synced — same bug
 * class as B-004 (Complete/Edit Info), just never fixed on this screen.
 */
export default function MeetingDetailScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    db.getFirstAsync<LocalMeetingRow>(
      `SELECT m.*, c.company_name as client_name
       FROM meetings m LEFT JOIN clients c ON c.id = m.client_id
       WHERE m.id = ?`,
      [id]
    ).then((row) => {
      if (!row) Alert.alert('Error', 'Meeting not found.');
      else setMeeting(rowToMeeting(row));
      setLoading(false);
    });
  }, [db, id]);

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Spinner size="large" color={COLORS.feather} />
      </YStack>
    );
  }

  if (!meeting) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor={COLORS.snow}>
        <Text>Meeting not found.</Text>
      </YStack>
    );
  }

  const isFastPath = Boolean(meeting.start_photo_url || meeting.end_photo_url);
  const outcomeStyle = meeting.outcome ? OUTCOME_BADGE_STYLES[meeting.outcome] : null;

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Meeting Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card>
          <Text fontWeight="800" fontSize={17} color={COLORS.eel}>
            {meeting.client_name ?? 'Unknown Client'}
          </Text>
          <XStack gap="$2" marginTop="$2" flexWrap="wrap">
            {outcomeStyle && meeting.outcome ? (
              <StatusBadge label={meeting.outcome} {...outcomeStyle} />
            ) : (
              <StatusBadge label="Photo visit (fast path)" background={COLORS.greenTint} color={COLORS.ledgeGreen} />
            )}
            {meeting.meeting_mode ? (
              <StatusBadge
                label={meeting.meeting_mode === 'online' ? 'Online' : 'In-person'}
                background={COLORS.purpleSoft}
                color={COLORS.purple}
              />
            ) : null}
          </XStack>
        </Card>

        {isFastPath ? (
          <>
            <SectionHeader title="Start" />
            <Card flexDirection="row" gap="$3" alignItems="center">
              {meeting.start_photo_url ? (
                <Image source={{ uri: meeting.start_photo_url }} style={{ width: 64, height: 64, borderRadius: 10 }} />
              ) : null}
              <Text fontSize={13} fontWeight="700" color={COLORS.eel}>
                {meeting.start_captured_at ? new Date(meeting.start_captured_at).toLocaleString() : '—'}
              </Text>
            </Card>

            <SectionHeader title="End" />
            <Card flexDirection="row" gap="$3" alignItems="center">
              {meeting.end_photo_url ? (
                <Image source={{ uri: meeting.end_photo_url }} style={{ width: 64, height: 64, borderRadius: 10 }} />
              ) : null}
              <Text fontSize={13} fontWeight="700" color={COLORS.eel}>
                {meeting.end_captured_at ? new Date(meeting.end_captured_at).toLocaleString() : '—'}
              </Text>
            </Card>
            <Text fontSize={11.5} fontWeight="600" color={COLORS.hare} marginTop="$2">
              Duration ay kino-compute sa Excel export (web-side) — hindi dito.
            </Text>
          </>
        ) : (
          <>
            <SectionHeader title="Selfie" />
            {meeting.selfie_url ? (
              <Image source={{ uri: meeting.selfie_url }} style={{ width: '100%', height: 200, borderRadius: 12 }} />
            ) : (
              <Text fontSize={13} color={COLORS.hare}>No photo.</Text>
            )}
          </>
        )}

        <SectionHeader title="Location" />
        <Card flexDirection="row" gap="$2" alignItems="center">
          <MapPin size={16} color={COLORS.eel} />
          <Text fontSize={12.5} fontWeight="700" color={COLORS.eel}>
            {meeting.gps_lat.toFixed(4)}, {meeting.gps_lng.toFixed(4)}
          </Text>
        </Card>

        {meeting.agendas.length > 0 ? (
          <>
            <SectionHeader title="Agenda" />
            <XStack gap="$2" flexWrap="wrap">
              {meeting.agendas.map((agenda) => (
                <StatusBadge key={agenda} label={agenda} background={COLORS.polar} color={COLORS.wolf} />
              ))}
            </XStack>
          </>
        ) : null}

        <Text fontSize={11.5} fontWeight="600" color={COLORS.hare} marginTop="$4" textAlign="center">
          Recorded {new Date(meeting.created_at).toLocaleString()}
        </Text>
      </ScrollView>
    </YStack>
  );
}
