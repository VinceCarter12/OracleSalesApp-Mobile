import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppDb } from '../../../lib/app-db-provider';
import { Camera, Check, ChevronRight, MapPin, Route, User } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { rowToMeeting, type LocalMeetingRow } from '../../../lib/local-meeting-mapper';
import {
  getMeetingCompanionRequests,
  companionRequestDisplayStatus,
  COMPANION_REQUEST_STATUS_LABELS,
  type ClientCompanionRequest,
} from '../../../lib/tag-along-service';
import { getPoConfirmationForMeeting, type PoConfirmationRecord } from '../../../lib/po-confirmation-service';
import { PO_CONFIRMATION_STATUS_LABELS, PO_CONFIRMATION_BADGE_TONES } from '../../../lib/policies/po-confirmation-status-policy';
import { OUTCOME_BADGE_STYLES, useBizlinkColors, BIZLINK_ON_INK, BIZLINK_FONTS } from '../../../lib/theme';
import { getClientById } from '../../../lib/client-service';
import { getClientStatus, getMeetingLifecycleStatus, WAITING_MANAGER_PO_APPROVAL_BADGE } from '../../../lib/client-status';
import { getClientJourneyProgress } from '../../../lib/client-progress';
import { useMeetings } from '../../../lib/useMeetings';
import { useClientFlowRoutes } from '../../../lib/use-role-routes';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ImagePreviewModal } from '../../../components/ui/ImagePreviewModal';
import { SyncBadge } from '../../../components/sync/SyncBadge';
import { SelectedClientCard } from '../../../components/meetings/SelectedClientCard';
import { formatMeetingLocation } from '../../../lib/format-meeting-location';
import type { OutboxStatus } from '../../../lib/sync/outbox-status';
import type { Client, Meeting } from '../../../types';
import { mapMeetingPhotoEvidence } from '../../../lib/meeting-photo-evidence';

/**
 * Local SQLite is the primary read path (ADR-001/T-004) — a meeting only
 * ever exists here until the outbox pushes it.
 */
export default function MeetingDetailScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const db = useAppDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const routes = useClientFlowRoutes();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [companionRequests, setCompanionRequests] = useState<ClientCompanionRequest[]>([]);
  const [poConfirmation, setPoConfirmation] = useState<PoConfirmationRecord | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  // Progress-card metric (lib/client-progress.ts::getClientJourneyProgress)
  // needs the client's own full meeting history, not just this one meeting —
  // `useMeetings` is undefined-safe (returns empty until `meeting` resolves).
  const { meetings: clientMeetings } = useMeetings(meeting?.client_id ?? undefined);

  useEffect(() => {
    if (!id) return;
    db.getFirstAsync<LocalMeetingRow>(
      `SELECT m.*, c.company_name as joined_client_name
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
    // ADR-044/046 point 7: best-effort PO confirmation status — absent
    // entirely for a meeting with no 'Close deal' agenda.
    getPoConfirmationForMeeting(id)
      .then(setPoConfirmation)
      .catch((err) => console.error('[MeetingDetail] PO confirmation load failed:', err instanceof Error ? err.message : String(err)));
  }, [db, id]);

  useEffect(() => {
    if (!meeting?.client_id) {
      setClient(null);
      return;
    }
    getClientById(meeting.client_id)
      .then(setClient)
      .catch((err) => console.error('[MeetingDetail] client load failed:', err instanceof Error ? err.message : String(err)));
  }, [meeting?.client_id]);

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
  // Live — must stay live: gates the "Waiting for Manager's Approval" PO
  // badge below, which reflects a real-time pending decision, not history.
  const clientStatus = client ? getClientStatus(client) : null;
  // B-095 fix: the header card displays what THIS meeting's client status
  // was when it was recorded (frozen snapshot), never the client's current
  // status — same fix as MeetingRow.tsx/Manager meetings list, extended here
  // after Vince found the same live-status bug on this screen's header card.
  // Null (no second badge/stage-rail highlight) for meetings recorded before
  // Migration v26 added the column — deliberately not backfilled/guessed.
  const displayStatus = getMeetingLifecycleStatus(meeting);
  const selfieEvidence = mapMeetingPhotoEvidence(meeting, 'selfie');
  const startEvidence = mapMeetingPhotoEvidence(meeting, 'start');
  const endEvidence = mapMeetingPhotoEvidence(meeting, 'end');
  const progress = client ? getClientJourneyProgress(client, clientMeetings) : null;
  // Only present when the row has a real client_id (legacy rows missing one
  // must never navigate into a broken journey route) AND this screen is
  // mounted under (tabs) — `routes.clientJourney` has no (manager) route yet
  // (see lib/use-role-routes.ts), and this exact screen is reused byte-for-
  // byte under (manager) via app/(manager)/clients/meeting/[id].tsx, reached
  // live today from Manager's own client-detail meeting history. Hide the
  // card there rather than building a Href that 404s.
  const journeyClientId = !routes.isManager ? meeting.client_id : null;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Meeting Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <SelectedClientCard
          clientName={meeting.client_name ?? null}
          status={displayStatus}
          progress={progress ?? undefined}
        />

        <XStack gap="$2" marginBottom="$3" flexWrap="wrap" alignItems="center">
          {outcomeStyle && meeting.outcome ? (
            <StatusBadge label={meeting.outcome} {...outcomeStyle} />
          ) : (
            <StatusBadge label="Photo-only visit" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
          )}
          {meeting.meeting_mode ? (
            <StatusBadge
              label={meeting.meeting_mode === 'online' ? 'Online meeting' : 'Face-to-face visit'}
              background={BIZLINK_COLORS.soft}
              color={BIZLINK_COLORS.navy}
            />
          ) : null}
          {meeting.sync_status ? <SyncBadge status={meeting.sync_status as OutboxStatus} /> : null}
          {/* Vince 2026-08-04: overlay badge — this meeting's client is in_progress AND
              its PO confirmation was submitted but not yet decided by a Manager. Uses
              `poConfirmation` (already loaded above) rather than a fresh lookup — this
              screen already has the exact per-meeting request, which is more precise
              than the client-list screens' bulk per-client check. */}
          {clientStatus === 'in_progress' && poConfirmation?.displayStatus === 'pending' ? (
            <StatusBadge
              label={WAITING_MANAGER_PO_APPROVAL_BADGE.label}
              background={BIZLINK_COLORS[WAITING_MANAGER_PO_APPROVAL_BADGE.background]}
              color={BIZLINK_COLORS[WAITING_MANAGER_PO_APPROVAL_BADGE.color]}
            />
          ) : null}
        </XStack>

        {poConfirmation ? (
          <YStack backgroundColor={BIZLINK_COLORS[PO_CONFIRMATION_BADGE_TONES[poConfirmation.displayStatus].background]} borderRadius={20} padding={14} marginTop="$3">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS[PO_CONFIRMATION_BADGE_TONES[poConfirmation.displayStatus].color]} lineHeight={17}>
              PO evidence — {PO_CONFIRMATION_STATUS_LABELS[poConfirmation.displayStatus]}
            </Text>
            {poConfirmation.decisionNote ? (
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={4} lineHeight={16}>
                {poConfirmation.decisionNote}
              </Text>
            ) : null}
          </YStack>
        ) : null}

        {companionRequests.length > 0 ? (
          <YStack backgroundColor={BIZLINK_COLORS.tintA} borderRadius={20} padding={14} marginTop="$3">
            {companionRequests.map((request) => {
              const status = companionRequestDisplayStatus(request);
              const name = request.inviteeName ?? 'Companion';
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
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Date and time</Text>
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
                  {meeting.start_captured_at ? new Date(meeting.start_captured_at).toLocaleString() : '—'}
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$3">
                {meeting.start_photo_url ? (
                  <Pressable onPress={() => meeting.start_photo_url && setPreviewImageUrl(meeting.start_photo_url)}>
                    <Image source={{ uri: meeting.start_photo_url }} style={{ width: 56, height: 56, borderRadius: 16 }} />
                  </Pressable>
                ) : (
                  <YStack width={56} height={56} borderRadius={16} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
                    <Camera size={20} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
                  </YStack>
                )}
                <YStack>
                  <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Start photo</Text>
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Saved</Text>
                  <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>{startEvidence.gpsLat !== null ? `Location ${startEvidence.gpsLat.toFixed(4)}, ${startEvidence.gpsLng?.toFixed(4)}` : 'Location unavailable'} · {startEvidence.capturedAt ? new Date(startEvidence.capturedAt).toLocaleString() : 'Date and time unavailable'}</Text>
                  <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Client's stage at this meeting: {startEvidence.clientStatusLabel}</Text>
                </YStack>
              </XStack>
            </YStack>

            <BizSectionHeader title="End" />
            <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16} gap="$2.5">
              <XStack alignItems="center" gap="$2">
                <Check size={14} color="#8FD7B4" strokeWidth={1.75} />
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Date and time</Text>
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
                  {meeting.end_captured_at ? new Date(meeting.end_captured_at).toLocaleString() : '—'}
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$3">
                {meeting.end_photo_url ? (
                  <Pressable onPress={() => meeting.end_photo_url && setPreviewImageUrl(meeting.end_photo_url)}>
                    <Image source={{ uri: meeting.end_photo_url }} style={{ width: 56, height: 56, borderRadius: 16 }} />
                  </Pressable>
                ) : (
                  <YStack width={56} height={56} borderRadius={16} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
                    <Camera size={20} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
                  </YStack>
                )}
                <YStack>
                  <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>End photo</Text>
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Saved</Text>
                  <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>{endEvidence.gpsLat !== null ? `Location ${endEvidence.gpsLat.toFixed(4)}, ${endEvidence.gpsLng?.toFixed(4)}` : 'Location unavailable'} · {endEvidence.capturedAt ? new Date(endEvidence.capturedAt).toLocaleString() : 'Date and time unavailable'}</Text>
                  <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Client's stage at this meeting: {endEvidence.clientStatusLabel}</Text>
                </YStack>
              </XStack>
            </YStack>
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2" textAlign="center">
              Duration is computed in the Excel export (web side) — it isn't shown here.
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
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Location</Text>
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
                  <Pressable onPress={() => meeting.selfie_url && setPreviewImageUrl(meeting.selfie_url)}>
                    <Image source={{ uri: meeting.selfie_url }} style={{ width: 56, height: 56, borderRadius: 16 }} />
                  </Pressable>
                ) : (
                  <YStack width={56} height={56} borderRadius={16} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
                    <Camera size={20} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
                  </YStack>
                )}
                <YStack flex={1}>
                  <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Selfie photo</Text>
                  <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>{selfieEvidence.gpsLat !== null ? `Location ${selfieEvidence.gpsLat.toFixed(4)}, ${selfieEvidence.gpsLng?.toFixed(4)}` : 'Location unavailable'} · {selfieEvidence.capturedAt ? new Date(selfieEvidence.capturedAt).toLocaleString() : 'Date and time unavailable'}</Text>
                  <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Client's stage at this meeting: {selfieEvidence.clientStatusLabel}</Text>
                </YStack>
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

        {/* Wireframe-Sales-BizLink.html:2075 `journey-preview` — grouped
            right beside the progress-summary bar at both its fast-path and
            standard `aOpenMeeting()` call sites; this screen renders Agenda/
            Remarks in one shared block rather than duplicating them per
            branch, so the preview lives here where it's reachable from both.
            Only rendered once the client resolves with a real `client_id` —
            never routes to a broken journey screen for a legacy row. */}
        {journeyClientId ? (
          <Pressable onPress={() => router.push(routes.clientJourney(journeyClientId, String(routes.meetingDetail(meeting.id))))}>
            <BizCard marginTop="$3" flexDirection="row" alignItems="center" gap="$3">
              <YStack
                width={42}
                height={42}
                borderRadius={14}
                backgroundColor={BIZLINK_COLORS.tintA}
                alignItems="center"
                justifyContent="center"
              >
                <Route size={17} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
              </YStack>
              <YStack flex={1} gap="$0.5">
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
                  Client journey & activities
                </Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  See the meetings, outcomes, and stage movement.
                </Text>
              </YStack>
              <ChevronRight size={18} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            </BizCard>
          </Pressable>
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
          Meeting saved by you on {new Date(meeting.created_at).toLocaleString()}
        </Text>
      </ScrollView>

      <ImagePreviewModal
        visible={Boolean(previewImageUrl)}
        imageUrl={previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
      />
    </YStack>
  );
}
