import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Camera, Check, MapPin, User } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { rowToMeeting, type LocalMeetingRow } from '../../../lib/local-meeting-mapper';
import {
  getMeetingCompanionRequests,
  companionRequestDisplayStatus,
  COMPANION_REQUEST_STATUS_LABELS,
  type ClientCompanionRequest,
} from '../../../lib/tag-along-service';
import { OUTCOME_BADGE_STYLES, useBizlinkColors, BIZLINK_ON_INK, BIZLINK_FONTS } from '../../../lib/theme';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SyncBadge } from '../../../components/sync/SyncBadge';
import type { OutboxStatus } from '../../../lib/sync/outbox-status';
import type { Meeting } from '../../../types';

/** Meeting's `location_type`/`location_name` → the wireframe's human-readable Location line. */
function formatMeetingLocation(meeting: Meeting): string | null {
  if (!meeting.location_type) return null;
  return meeting.location_type === 'Others' ? (meeting.location_name || 'Others') : 'Client Office';
}

/**
 * Local SQLite is the primary read path (ADR-001/T-004) — a meeting only
 * ever exists here until the outbox pushes it.
 */
export default function MeetingDetailScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [companionRequests, setCompanionRequests] = useState<ClientCompanionRequest[]>([]);
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
    }).catch((err) => {
      console.error('[MeetingDetail] load failed:', err instanceof Error ? err.message : String(err));
      Alert.alert('Error', 'Failed to load meeting.');
      setLoading(false);
    });
    // Best-effort — the tag-along banner just stays empty if this fails,
    // never blocks the meeting itself from displaying.
    getMeetingCompanionRequests(id)
      .then(setCompanionRequests)
      .catch((err) => console.error('[MeetingDetail] companion requests load failed:', err instanceof Error ? err.message : String(err)));
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
  const humanLocation = formatMeetingLocation(meeting);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Meeting Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard>
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>
            {meeting.client_name ?? 'Unknown Client'}
          </Text>
          <XStack gap="$2" marginTop="$2" flexWrap="wrap" alignItems="center">
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
            {meeting.sync_status ? <SyncBadge status={meeting.sync_status as OutboxStatus} /> : null}
          </XStack>
        </BizCard>

        {companionRequests.length > 0 ? (
          <YStack backgroundColor={BIZLINK_COLORS.tintA} borderRadius={20} padding={14} marginTop="$3">
            {companionRequests.map((request) => {
              const status = companionRequestDisplayStatus(request);
              const name = request.inviteeName ?? 'Kasama';
              return (
                <Text key={request.id} fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.ink} lineHeight={17}>
                  {name} — {COMPANION_REQUEST_STATUS_LABELS[status]}
                </Text>
              );
            })}
          </YStack>
        ) : null}

        {isFastPath ? (
          <>
            <BizSectionHeader title="Start" />
            <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16} gap="$2.5">
              <XStack alignItems="center" gap="$2">
                <Check size={14} color="#8FD7B4" strokeWidth={1.75} />
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Timestamp</Text>
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
                  {meeting.start_captured_at ? new Date(meeting.start_captured_at).toLocaleString() : '—'}
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$3">
                {meeting.start_photo_url ? (
                  <Image source={{ uri: meeting.start_photo_url }} style={{ width: 56, height: 56, borderRadius: 16 }} />
                ) : (
                  <YStack width={56} height={56} borderRadius={16} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
                    <Camera size={20} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
                  </YStack>
                )}
                <YStack>
                  <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Start photo</Text>
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Locked</Text>
                </YStack>
              </XStack>
            </YStack>

            <BizSectionHeader title="End" />
            <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16} gap="$2.5">
              <XStack alignItems="center" gap="$2">
                <Check size={14} color="#8FD7B4" strokeWidth={1.75} />
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Timestamp</Text>
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
                  {meeting.end_captured_at ? new Date(meeting.end_captured_at).toLocaleString() : '—'}
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$3">
                {meeting.end_photo_url ? (
                  <Image source={{ uri: meeting.end_photo_url }} style={{ width: 56, height: 56, borderRadius: 16 }} />
                ) : (
                  <YStack width={56} height={56} borderRadius={16} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
                    <Camera size={20} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
                  </YStack>
                )}
                <YStack>
                  <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>End photo</Text>
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Locked</Text>
                </YStack>
              </XStack>
            </YStack>
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2" textAlign="center">
              Walang duration dito — kino-compute sa Excel export (web-side).
            </Text>
          </>
        ) : (
          <>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.5} marginTop="$4" marginBottom="$1">
              Auto-captured
            </Text>
            <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16} gap="$2.5">
              <XStack alignItems="center" gap="$2">
                <Check size={14} color="#8FD7B4" strokeWidth={1.75} />
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>GPS</Text>
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
                  {meeting.gps_lat.toFixed(4)}° N, {meeting.gps_lng.toFixed(4)}° E
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$2">
                <Check size={14} color="#8FD7B4" strokeWidth={1.75} />
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Date & time</Text>
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>{new Date(meeting.logged_at).toLocaleString()}</Text>
              </XStack>
              <XStack alignItems="center" gap="$3">
                {meeting.selfie_url ? (
                  <Image source={{ uri: meeting.selfie_url }} style={{ width: 56, height: 56, borderRadius: 16 }} />
                ) : (
                  <YStack width={56} height={56} borderRadius={16} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
                    <Camera size={20} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
                  </YStack>
                )}
                <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Selfie captured</Text>
              </XStack>
            </YStack>

            {meeting.contact_person || humanLocation ? (
              <>
                <BizSectionHeader title="Details" />
                <BizCard gap="$2.5">
                  {meeting.contact_person ? (
                    <XStack alignItems="center" gap="$2.5">
                      <User size={15} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
                      <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} flex={1}>
                        Contact: {meeting.contact_person}
                      </Text>
                      {meeting.contact_position ? (
                        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{meeting.contact_position}</Text>
                      ) : null}
                    </XStack>
                  ) : null}
                  {humanLocation ? (
                    <XStack alignItems="center" gap="$2.5">
                      <MapPin size={15} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
                      <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                        Location: {humanLocation}
                      </Text>
                    </XStack>
                  ) : null}
                </BizCard>
              </>
            ) : null}
          </>
        )}

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

        {meeting.remarks ? (
          <>
            <BizSectionHeader title="Remarks" />
            <BizCard>
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} lineHeight={18}>
                {meeting.remarks}
              </Text>
            </BizCard>
          </>
        ) : null}

        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$4" textAlign="center">
          Recorded {new Date(meeting.created_at).toLocaleString()}
        </Text>
      </ScrollView>
    </YStack>
  );
}
