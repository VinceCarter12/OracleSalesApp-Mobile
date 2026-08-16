import { Image, Pressable, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Camera, Check, MapPin, Tag, User, Users as UsersIcon, Video } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, OUTCOME_BADGE_STYLES } from '../../../../lib/theme';
import { useTeamOverview } from '../../../../lib/use-team-overview';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { meetingBadge } from '../../../../lib/meeting-badge';
import { avatarPaletteFor } from '../../../../lib/avatar-palette';
import { initialsFromName } from '../../../../lib/display-name';
import { useSession } from '../../../../lib/session-store';
import { MANAGER_OUTCOME_LABELS } from '../../../../types';
import { getManagerApprovalFeed, type ManagerApprovalFeedItem } from '../../../../lib/po-confirmation-manager-service';
import { getOwnMeetingCompanionRequest, type IncomingCompanionRequest } from '../../../../lib/tag-along-invitee-service';
import { ImagePreviewModal } from '../../../../components/ui/ImagePreviewModal';
import type { MeetingEvidenceAuditDetails } from '../../../../components/ui/MeetingEvidenceDownload';
import type { TeamClient, TeamMeeting } from '../../../../types';

/** Wireframe s-meetingdetail. Branches on fastPath (ADR-015) and meetingMode (ADR-012). Real data (B-054 Phase 1). */
export default function ManagerMeetingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { overview, loading, error, reload } = useTeamOverview();
  const { profileId, fullName } = useSession();
  const [localCompanion, setLocalCompanion] = useState<IncomingCompanionRequest | null>(null);
  const [preview, setPreview] = useState<{ url: string; details: MeetingEvidenceAuditDetails } | null>(null);

  useEffect(() => {
    let active = true;
    setLocalCompanion(null);
    if (!profileId || !id) {
      return () => { active = false; };
    }
    getOwnMeetingCompanionRequest(profileId, id)
      .then((request) => { if (active) setLocalCompanion(request); })
      .catch((error) => console.error('[ManagerMeetingDetail] local companion load failed:', error instanceof Error ? error.message : String(error)));
    return () => { active = false; };
  }, [id, profileId]);

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas} gap="$3" paddingHorizontal="$5">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
        <BizButton small label="Try again" variant="white" onPress={reload} />
      </YStack>
    );
  }

  const meeting = overview?.meetings.find((m) => m.id === id);
  if (!meeting) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Meeting not found.</Text>
      </YStack>
    );
  }

  const client = overview?.clients.find((c) => c.id === meeting.clientId);
  const agent = overview?.agents.find((a) => a.id === meeting.agentId)
    ?? (profileId === meeting.agentId && fullName ? { id: profileId, name: fullName, initials: initialsFromName(fullName) } : undefined);
  const isOnline = meeting.meetingMode === 'online';
  const sharedMeeting = Boolean(localCompanion);
  const sharedManagerName = localCompanion ? (fullName?.trim() || 'You') : undefined;
  const sharedStatus = localCompanion?.status === 'pending'
    ? 'pending'
    : localCompanion?.status === 'accepted'
      ? 'approved'
      : localCompanion?.status === 'declined'
        ? 'rejected'
        : undefined;
  const openEvidence = (url: string, title: string, capturedAt?: string | null, location?: string): void => {
    setPreview({
      url,
      details: {
        title,
        capturedAt: capturedAt ?? meeting.meetingDateIso ?? null,
        clientStatus: formatClientStatus(meeting.clientStatusAtMeeting ?? client?.status),
        location: location ?? meeting.location ?? meeting.gps ?? 'Not recorded',
        duration: formatEvidenceDuration(meeting.startCapturedAt, meeting.endCapturedAt),
      },
    });
  };

  const ModeBadge = isOnline ? (
    <XStack alignItems="center" gap="$1" backgroundColor={BIZLINK_COLORS.soft} borderRadius={999} paddingHorizontal={10} paddingVertical={3}>
      <Video size={11} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.navy}>Online</Text>
    </XStack>
  ) : null;

  if (meeting.fastPath) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Meeting Detail" fallbackHref="/(manager)/more/meetings" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <HeaderCard agentName={agent?.name} agentId={agent?.id} initials={agent?.initials} clientName={client?.name} />
          <ManagerSharedRecordCard shared={sharedMeeting} managerName={sharedManagerName} status={sharedStatus} />
          <BizSectionHeader title="Status" />
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            {meetingBadge(meeting)}
            <StatusBadge
              label={meeting.synced ? '✓ uploaded' : '↻ waiting to upload'}
              background={meeting.synced ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft}
              color={meeting.synced ? BIZLINK_COLORS.brand : BIZLINK_COLORS.navy}
            />
            {ModeBadge}
          </XStack>

          <BizSectionHeader title="Start" />
          <PhotoRow label="Start photo" time={meeting.startTime} imageUrl={meeting.startPhotoUrl} onOpenImage={(url) => openEvidence(url, 'Start photo', meeting.startCapturedAt, meeting.gps)} />
          <BizSectionHeader title="End" />
          <PhotoRow label="End photo" time={meeting.endTime} imageUrl={meeting.endPhotoUrl} onOpenImage={(url) => openEvidence(url, 'End photo', meeting.endCapturedAt, formatCoordinates(meeting.endGpsLat, meeting.endGpsLng) ?? meeting.gps)} />
          <ManagerMeetingPoEvidence meetingId={meeting.id} onOpenImage={(url) => openEvidence(url, 'PO evidence')} />

          {meeting.agenda.length ? (
            <>
              <BizSectionHeader title="Agenda" />
              <XStack gap="$2" flexWrap="wrap">
                {meeting.agenda.map((a) => (
                  <BizChip key={a} label={a} selected onPress={() => {}} />
                ))}
              </XStack>
            </>
          ) : null}

          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$4">
            Duration is computed in the Excel export (web side) — it isn't shown here.
          </Text>
        </ScrollView>
        <ImagePreviewModal visible={preview !== null} imageUrl={preview?.url ?? null} auditDetails={preview?.details} onClose={() => setPreview(null)} />
      </YStack>
    );
  }

  const outcomeLabel = meeting.outcome ? MANAGER_OUTCOME_LABELS[meeting.outcome] : null;
  const outcomeStyle = outcomeLabel ? OUTCOME_BADGE_STYLES[outcomeLabel] : null;
  const gpsNote = isOnline
    ? 'Online meeting — the location saved is the agent\'s own location, not the client\'s'
    : meeting.tagAlong
      ? `The manager ${meeting.tagAlongManagerName} appears in the photo as proof`
      : 'Location saved at the moment the photo was taken';

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Meeting Detail" fallbackHref="/(manager)/more/meetings" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <HeaderCard agentName={agent?.name} agentId={agent?.id} initials={agent?.initials} clientName={client?.name} />
        <ManagerSharedRecordCard shared={sharedMeeting} managerName={sharedManagerName} status={sharedStatus} />

        <BizSectionHeader title="Outcome" />
        <XStack alignItems="center" gap="$2" flexWrap="wrap">
          {outcomeLabel && outcomeStyle ? (
            <StatusBadge label={outcomeLabel} background={outcomeStyle.background} color={outcomeStyle.color} />
          ) : null}
          <StatusBadge
            label={meeting.synced ? '✓ uploaded' : '↻ waiting to upload'}
            background={meeting.synced ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft}
            color={meeting.synced ? BIZLINK_COLORS.brand : BIZLINK_COLORS.navy}
          />
          {ModeBadge}
          {meeting.tagAlong ? (
            <StatusBadge
              label={meeting.tagAlongStatus === 'pending' ? 'Waiting for your decision' : 'Companion approved'}
              background={BIZLINK_COLORS.tintA}
              color={BIZLINK_COLORS.brand}
            />
          ) : null}
        </XStack>

        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textTransform="uppercase" letterSpacing={0.4} marginTop="$4" marginBottom="$1">
          Auto-captured — the sales rep's own record
        </Text>
        <BizCard flat>
          <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
            <Check size={14} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Location</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{meeting.gps}</Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
            <Check size={14} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Date & time</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{meeting.date} · {meeting.time}</Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
            {meeting.selfieUrl ? (
              <Pressable accessibilityRole="button" accessibilityLabel="View meeting photo" onPress={() => openEvidence(meeting.selfieUrl!, 'Meeting selfie')}>
                <Image source={{ uri: meeting.selfieUrl }} style={{ width: 60, height: 60, borderRadius: 16 }} />
              </Pressable>
            ) : (
              <YStack width={60} height={60} borderRadius={16} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
                <Camera size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              </YStack>
            )}
            <YStack flex={1}>
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Meeting photo captured</Text>
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{gpsNote} Tap photo to view or download.</Text>
            </YStack>
          </XStack>
        </BizCard>
        <ManagerMeetingPoEvidence meetingId={meeting.id} onOpenImage={(url) => openEvidence(url, 'PO evidence')} />

        <BizSectionHeader title="Details" />
        <BizCard>
          <DetailRow icon={<User size={14} color={BIZLINK_COLORS.card} strokeWidth={1.75} />} label={`Contact: ${meeting.contact}`} extra={meeting.position} />
          <DetailRow icon={<Tag size={14} color={BIZLINK_COLORS.card} strokeWidth={1.75} />} label={`Customer type: ${meeting.custType}`} />
          <DetailRow icon={<MapPin size={14} color={BIZLINK_COLORS.card} strokeWidth={1.75} />} label={`Location: ${meeting.location}`} last />
        </BizCard>

        <BizSectionHeader title="Agenda covered" />
        <XStack gap="$2" flexWrap="wrap">
          {meeting.agenda.map((a) => (
            <BizChip key={a} label={a} selected onPress={() => {}} />
          ))}
        </XStack>

        <BizSectionHeader title="Remarks" />
        <BizCard flat><Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} lineHeight={19} color={BIZLINK_COLORS.text}>{meeting.remarks}</Text></BizCard>

        {meeting.tagAlong ? (
          <XStack alignItems="flex-start" gap="$2" backgroundColor={BIZLINK_COLORS.soft} borderRadius={20} padding={14} marginTop="$3.5">
            <UsersIcon size={15} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.navy} flex={1} lineHeight={17}>
              Companion — {meeting.tagAlongManagerName} joined. {meeting.tagAlongStatus === 'pending'
                ? 'Waiting for your decision (see the Requests tab).'
                : 'You approved this.'} This is one single record — the manager does not get a separate meeting entry.
            </Text>
          </XStack>
        ) : null}
      </ScrollView>
      <ImagePreviewModal visible={preview !== null} imageUrl={preview?.url ?? null} auditDetails={preview?.details} onClose={() => setPreview(null)} />
    </YStack>
  );
}

function HeaderCard({ agentName, agentId, initials, clientName }: { agentName?: string; agentId?: string; initials?: string; clientName?: string }) {
  const palette = avatarPaletteFor(agentId ?? 'unassigned');
  return (
    <BizCard flexDirection="row" alignItems="center" gap="$3">
      <YStack width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={palette.background}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={palette.color}>{initials ?? agentName?.split(' ').map((name) => name[0]).join('') ?? '—'}</Text>
      </YStack>
      <YStack>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text}>{clientName}</Text>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Agent: {agentName}</Text>
      </YStack>
    </BizCard>
  );
}

function PhotoRow({ label, time, imageUrl, onOpenImage }: { label: string; time?: string; imageUrl?: string | null; onOpenImage: (url: string) => void }) {
  return (
    <BizCard flat>
      <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
        <Check size={14} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Date and time</Text>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{time}</Text>
      </XStack>
      <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
        {imageUrl ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${label}`} onPress={() => onOpenImage(imageUrl)}>
            <Image source={{ uri: imageUrl }} style={{ width: 60, height: 60, borderRadius: 16 }} />
          </Pressable>
        ) : (
          <YStack width={60} height={60} borderRadius={16} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
            <Camera size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          </YStack>
        )}
        <YStack>
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{label}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Tap to view or download</Text>
        </YStack>
      </XStack>
    </BizCard>
  );
}

function ManagerSharedRecordCard({ shared, managerName, status }: { shared: boolean; managerName?: string; status?: 'pending' | 'approved' | 'rejected' }) {
  return (
    <BizCard marginTop="$3" gap="$1.5">
      <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>{shared ? 'Shared meeting record' : 'Canonical meeting record'}</Text>
      {managerName ? (
        <Text fontFamily={BIZLINK_FONTS.medium} fontSize={12} color={BIZLINK_COLORS.muted}>
          Selected manager: {managerName}{status ? ` · ${status === 'pending' ? 'Pending' : status === 'approved' ? 'Accepted' : 'Declined'}` : ''}
        </Text>
      ) : (
        <Text fontFamily={BIZLINK_FONTS.medium} fontSize={12} color={BIZLINK_COLORS.muted}>No manager attendee is available in this local record.</Text>
      )}
      <Text fontFamily={BIZLINK_FONTS.medium} fontSize={11.5} color={BIZLINK_COLORS.muted} lineHeight={16}>
        {shared ? 'This is one canonical meeting record. A team-wide attendee list is not available offline yet.' : 'This meeting has no locally recorded manager attendee.'}
      </Text>
    </BizCard>
  );
}

function ManagerMeetingPoEvidence({ meetingId, onOpenImage }: { meetingId: string; onOpenImage: (url: string) => void }) {
  const [record, setRecord] = useState<ManagerApprovalFeedItem | null>(null);
  useEffect(() => {
    let active = true;
    getManagerApprovalFeed()
      .then((items) => {
        const match = items.find((item) => item.requestKind === 'po_confirmation' && item.summary.meeting_id === meetingId) ?? null;
        if (active) setRecord(match);
      })
      .catch((error) => console.error('[ManagerMeetingDetail] PO load failed:', error instanceof Error ? error.message : String(error)));
    return () => { active = false; };
  }, [meetingId]);
  if (!record || record.requestKind !== 'po_confirmation') return null;
  const photoPath = typeof record.summary.po_photo_path === 'string' && record.summary.po_photo_path ? record.summary.po_photo_path : null;
  return (
    <>
      <BizSectionHeader title="PO evidence" />
      <BizCard flat>
        <XStack alignItems="center" gap="$3">
          {photoPath ? (
            <Pressable accessibilityRole="button" accessibilityLabel="View PO evidence" onPress={() => onOpenImage(photoPath)}>
              <Image source={{ uri: photoPath }} style={{ width: 64, height: 64, borderRadius: 16 }} />
            </Pressable>
          ) : null}
          <YStack flex={1}>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>PO confirmation</Text>
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{record.status === 'approved' ? 'Approved' : record.status === 'rejected' ? 'Rejected' : 'Pending approval'} · Tap image to view or download</Text>
          </YStack>
        </XStack>
      </BizCard>
    </>
  );
}

function formatClientStatus(status: TeamMeeting['clientStatusAtMeeting'] | TeamClient['status'] | null | undefined): string {
  if (!status) return 'Not recorded';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCoordinates(lat: number | null | undefined, lng: number | null | undefined): string | null {
  return lat !== null && lat !== undefined && lng !== null && lng !== undefined ? `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E` : null;
}

function formatEvidenceDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return 'Not recorded';
  const durationMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'Not recorded';
  const minutes = Math.floor(durationMs / 60000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function DetailRow({ icon, label, extra, last }: { icon: React.ReactNode; label: string; extra?: string; last?: boolean }) {
  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      paddingVertical={9}
      borderBottomWidth={last ? 0 : 1}
      borderBottomColor={BIZLINK_COLORS.line}
    >
      <YStack width={22} height={22} borderRadius={11} backgroundColor={BIZLINK_COLORS.brand} alignItems="center" justifyContent="center">
        {icon}
      </YStack>
      <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} flex={1}>{label}</Text>
      {extra ? <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{extra}</Text> : null}
    </XStack>
  );
}
