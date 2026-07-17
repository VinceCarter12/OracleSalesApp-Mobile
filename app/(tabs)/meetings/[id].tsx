import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MapPin } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { rowToMeeting, type LocalMeetingRow } from '../../../lib/local-meeting-mapper';
import { OUTCOME_BADGE_STYLES, BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { Meeting } from '../../../types';

/**
 * Local SQLite is the primary read path (ADR-001/T-004) — a meeting only
 * ever exists here until the outbox pushes it.
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
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (!meeting) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Meeting not found.</Text>
      </YStack>
    );
  }

  const isFastPath = Boolean(meeting.start_photo_url || meeting.end_photo_url);
  const outcomeStyle = meeting.outcome ? OUTCOME_BADGE_STYLES[meeting.outcome] : null;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Meeting Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard>
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>
            {meeting.client_name ?? 'Unknown Client'}
          </Text>
          <XStack gap="$2" marginTop="$2" flexWrap="wrap">
            {outcomeStyle && meeting.outcome ? (
              <StatusBadge label={meeting.outcome} {...outcomeStyle} />
            ) : (
              <StatusBadge label="Photo visit (fast path)" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
            )}
            {meeting.meeting_mode ? (
              <StatusBadge
                label={meeting.meeting_mode === 'online' ? 'Online' : 'In-person'}
                background={BIZLINK_COLORS.soft}
                color={BIZLINK_COLORS.navy}
              />
            ) : null}
          </XStack>
        </BizCard>

        {isFastPath ? (
          <>
            <BizSectionHeader title="Start" />
            <BizCard flexDirection="row" gap="$3" alignItems="center">
              {meeting.start_photo_url ? (
                <Image source={{ uri: meeting.start_photo_url }} style={{ width: 64, height: 64, borderRadius: 14 }} />
              ) : null}
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                {meeting.start_captured_at ? new Date(meeting.start_captured_at).toLocaleString() : '—'}
              </Text>
            </BizCard>

            <BizSectionHeader title="End" />
            <BizCard flexDirection="row" gap="$3" alignItems="center">
              {meeting.end_photo_url ? (
                <Image source={{ uri: meeting.end_photo_url }} style={{ width: 64, height: 64, borderRadius: 14 }} />
              ) : null}
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                {meeting.end_captured_at ? new Date(meeting.end_captured_at).toLocaleString() : '—'}
              </Text>
            </BizCard>
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2">
              Duration ay kino-compute sa Excel export (web-side) — hindi dito.
            </Text>
          </>
        ) : (
          <>
            <BizSectionHeader title="Selfie" />
            {meeting.selfie_url ? (
              <Image source={{ uri: meeting.selfie_url }} style={{ width: '100%', height: 200, borderRadius: 20 }} />
            ) : (
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>No photo.</Text>
            )}
          </>
        )}

        <BizSectionHeader title="Location" />
        <BizCard flexDirection="row" gap="$2" alignItems="center">
          <MapPin size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
            {meeting.gps_lat.toFixed(4)}, {meeting.gps_lng.toFixed(4)}
          </Text>
        </BizCard>

        {meeting.agendas.length > 0 ? (
          <>
            <BizSectionHeader title="Agenda" />
            <XStack gap="$2" flexWrap="wrap">
              {meeting.agendas.map((agenda) => (
                <StatusBadge key={agenda} label={agenda} background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.muted} />
              ))}
            </XStack>
          </>
        ) : null}

        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$4" textAlign="center">
          Recorded {new Date(meeting.created_at).toLocaleString()}
        </Text>
      </ScrollView>
    </YStack>
  );
}
