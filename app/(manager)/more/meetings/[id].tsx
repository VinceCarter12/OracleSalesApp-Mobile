import { ScrollView } from 'react-native';
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

/** Wireframe s-meetingdetail. Branches on fastPath (ADR-015) and meetingMode (ADR-012). Real data (B-054 Phase 1). */
export default function ManagerMeetingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { overview, loading, error, reload } = useTeamOverview();
  const { profileId, fullName } = useSession();

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
          <PhotoRow label="Start photo" time={meeting.startTime} />
          <BizSectionHeader title="End" />
          <PhotoRow label="End photo" time={meeting.endTime} />

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
            <YStack width={60} height={60} borderRadius={16} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
              <Camera size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            </YStack>
            <YStack flex={1}>
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Meeting photo captured</Text>
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{gpsNote}</Text>
            </YStack>
          </XStack>
        </BizCard>

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

function PhotoRow({ label, time }: { label: string; time?: string }) {
  return (
    <BizCard flat>
      <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
        <Check size={14} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Date and time</Text>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{time}</Text>
      </XStack>
      <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
        <YStack width={60} height={60} borderRadius={16} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
          <Camera size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
        </YStack>
        <YStack>
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{label}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Saved</Text>
        </YStack>
      </XStack>
    </BizCard>
  );
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
