import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Camera, Check, MapPin, Tag, User, Users as UsersIcon, Video } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, OUTCOME_BADGE_STYLES } from '../../../../lib/theme';
import { agentById, clientById } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { meetingBadge } from '../../../../lib/meeting-badge';
import { MANAGER_OUTCOME_LABELS } from '../../../../types';

/** Wireframe s-meetingdetail — gated. Branches on fastPath (ADR-015) and meetingMode (ADR-012). */
export default function ManagerMeetingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { meetings } = useManagerStore();

  if (!unlocked) return <SecurityGate />;

  const meeting = meetings.find((m) => m.id === id);
  if (!meeting) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Meeting not found.</Text>
      </YStack>
    );
  }

  const client = clientById(meeting.clientId);
  const agent = agentById(meeting.agentId);
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
        <BizTopBar title="Meeting Detail" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <HeaderCard agentName={agent?.name} clientName={client?.name} />
          <BizSectionHeader title="Status" />
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            {meetingBadge(meeting)}
            <StatusBadge
              label={meeting.synced ? '✓ synced' : '↻ pending sync'}
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
            Walang duration dito — kino-compute sa Excel export (web-side).
          </Text>
        </ScrollView>
      </YStack>
    );
  }

  const outcomeLabel = meeting.outcome ? MANAGER_OUTCOME_LABELS[meeting.outcome] : null;
  const outcomeStyle = outcomeLabel ? OUTCOME_BADGE_STYLES[outcomeLabel] : null;
  const gpsNote = isOnline
    ? 'Online meeting — GPS = sariling lokasyon ng agent (ADR-012)'
    : meeting.tagAlong
      ? `Kasama sa litrato si ${meeting.tagAlongManagerName} bilang proof`
      : 'Location bound at shutter time';

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Meeting Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <HeaderCard agentName={agent?.name} clientName={client?.name} />

        <BizSectionHeader title="Outcome" />
        <XStack alignItems="center" gap="$2" flexWrap="wrap">
          {outcomeLabel && outcomeStyle ? (
            <StatusBadge label={outcomeLabel} background={outcomeStyle.background} color={outcomeStyle.color} />
          ) : null}
          <StatusBadge
            label={meeting.synced ? '✓ synced' : '↻ pending sync'}
            background={meeting.synced ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft}
            color={meeting.synced ? BIZLINK_COLORS.brand : BIZLINK_COLORS.navy}
          />
          {ModeBadge}
          {meeting.tagAlong ? (
            <StatusBadge
              label={meeting.tagAlongStatus === 'pending' ? 'Pending your approval' : 'Tag-along approved'}
              background={BIZLINK_COLORS.tintA}
              color={BIZLINK_COLORS.brand}
            />
          ) : null}
        </XStack>

        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textTransform="uppercase" letterSpacing={0.4} marginTop="$4" marginBottom="$1">
          Auto-captured — sales rep's own record
        </Text>
        <BizCard flat>
          <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
            <Check size={14} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>GPS</Text>
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
              Tag-along — kasama si {meeting.tagAlongManagerName}. {meeting.tagAlongStatus === 'pending'
                ? 'Naghihintay pa ng approval mo (see Approvals tab).'
                : 'Na-approve mo na ito.'} Iisang record lang ito — walang hiwalay na meeting entry ang manager.
            </Text>
          </XStack>
        ) : null}
      </ScrollView>
    </YStack>
  );
}

function HeaderCard({ agentName, clientName }: { agentName?: string; clientName?: string }) {
  return (
    <BizCard flexDirection="row" alignItems="center" gap="$3">
      <YStack width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.tintA}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.ink}>{agentName?.split(' ').map((n) => n[0]).join('')}</Text>
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
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Timestamp</Text>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{time}</Text>
      </XStack>
      <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
        <YStack width={60} height={60} borderRadius={16} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
          <Camera size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
        </YStack>
        <YStack>
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{label}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Locked</Text>
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
