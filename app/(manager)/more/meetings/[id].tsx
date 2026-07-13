import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Camera, Check, MapPin, Tag, User, Users as UsersIcon, Video } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS, OUTCOME_BADGE_STYLES } from '../../../../lib/theme';
import { agentById, clientById } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { TopBar } from '../../../../components/ui/TopBar';
import { Card } from '../../../../components/ui/Card';
import { SectionHeader } from '../../../../components/ui/SectionHeader';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { SelectTile } from '../../../../components/ui/SelectTile';
import { meetingBadge } from '../../../../lib/meeting-badge';
import { MANAGER_OUTCOME_LABELS } from '../../../../types';

/** Wireframe s-meetingdetail — gated. Branches on fastPath (ADR-015) and meetingMode (ADR-012). */
export default function ManagerMeetingDetailScreen() {
  const { unlocked } = useGate();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { meetings } = useManagerStore();

  if (!unlocked) return <SecurityGate />;

  const meeting = meetings.find((m) => m.id === id);
  if (!meeting) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Text>Meeting not found.</Text>
      </YStack>
    );
  }

  const client = clientById(meeting.clientId);
  const agent = agentById(meeting.agentId);
  const isOnline = meeting.meetingMode === 'online';

  const ModeBadge = isOnline ? (
    <XStack alignItems="center" gap="$1" backgroundColor={COLORS.purpleSoft} borderRadius={999} paddingHorizontal={10} paddingVertical={3}>
      <Video size={11} color={COLORS.purple} />
      <Text fontSize={10.5} fontWeight="800" color={COLORS.purple}>Online</Text>
    </XStack>
  ) : null;

  if (meeting.fastPath) {
    return (
      <YStack flex={1} backgroundColor={COLORS.snow}>
        <TopBar title="Meeting Detail" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <HeaderCard agentName={agent?.name} clientName={client?.name} />
          <SectionHeader title="Status" />
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            {meetingBadge(meeting)}
            <StatusBadge
              label={meeting.synced ? '✓ synced' : '↻ pending sync'}
              background={meeting.synced ? COLORS.greenSoft : COLORS.blueSoft}
              color={meeting.synced ? COLORS.ledgeGreen : COLORS.blue}
            />
            {ModeBadge}
          </XStack>

          <SectionHeader title="Start" />
          <PhotoRow label="Start photo" time={meeting.startTime} />
          <SectionHeader title="End" />
          <PhotoRow label="End photo" time={meeting.endTime} />

          {meeting.agenda.length ? (
            <>
              <SectionHeader title="Agenda" />
              <XStack gap="$2" flexWrap="wrap">
                {meeting.agenda.map((a) => (
                  <SelectTile key={a} label={a} selected onPress={() => {}} />
                ))}
              </XStack>
            </>
          ) : null}

          <Text fontSize={12.5} fontWeight="600" color={COLORS.hare} textAlign="center" marginTop="$4">
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
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Meeting Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <HeaderCard agentName={agent?.name} clientName={client?.name} />

        <SectionHeader title="Outcome" />
        <XStack alignItems="center" gap="$2" flexWrap="wrap">
          {outcomeLabel && outcomeStyle ? (
            <StatusBadge label={outcomeLabel} background={outcomeStyle.background} color={outcomeStyle.color} />
          ) : null}
          <StatusBadge
            label={meeting.synced ? '✓ synced' : '↻ pending sync'}
            background={meeting.synced ? COLORS.greenSoft : COLORS.blueSoft}
            color={meeting.synced ? COLORS.ledgeGreen : COLORS.blue}
          />
          {ModeBadge}
          {meeting.tagAlong ? (
            <StatusBadge
              label={meeting.tagAlongStatus === 'pending' ? 'Pending your approval' : 'Tag-along approved'}
              background={COLORS.greenTint}
              color={COLORS.ledgeGreen}
            />
          ) : null}
        </XStack>

        <Text fontSize={10.5} fontWeight="700" color={COLORS.hare} textTransform="uppercase" letterSpacing={0.6} marginTop="$4" marginBottom="$1">
          Auto-captured — sales rep's own record
        </Text>
        <Card flat>
          <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
            <Check size={14} color={COLORS.ledgeGreen} />
            <Text fontSize={12.5} fontWeight="700" color={COLORS.eel}>GPS</Text>
            <Text fontSize={12.5} fontWeight="600" color={COLORS.hare}>{meeting.gps}</Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
            <Check size={14} color={COLORS.ledgeGreen} />
            <Text fontSize={12.5} fontWeight="700" color={COLORS.eel}>Date & time</Text>
            <Text fontSize={12.5} fontWeight="600" color={COLORS.hare}>{meeting.date} · {meeting.time}</Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
            <View width={60} height={60} borderRadius={12} backgroundColor={COLORS.swan} alignItems="center" justifyContent="center">
              <Camera size={22} color={COLORS.wolf} />
            </View>
            <YStack flex={1}>
              <Text fontSize={12} fontWeight="800" color={COLORS.eel}>Meeting photo captured</Text>
              <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{gpsNote}</Text>
            </YStack>
          </XStack>
        </Card>

        <SectionHeader title="Details" />
        <Card>
          <DetailRow icon={<User size={14} color={COLORS.ledgeGreen} />} label={`Contact: ${meeting.contact}`} extra={meeting.position} />
          <DetailRow icon={<Tag size={14} color={COLORS.ledgeGreen} />} label={`Customer type: ${meeting.custType}`} />
          <DetailRow icon={<MapPin size={14} color={COLORS.ledgeGreen} />} label={`Location: ${meeting.location}`} last />
        </Card>

        <SectionHeader title="Agenda covered" />
        <XStack gap="$2" flexWrap="wrap">
          {meeting.agenda.map((a) => (
            <SelectTile key={a} label={a} selected onPress={() => {}} />
          ))}
        </XStack>

        <SectionHeader title="Remarks" />
        <Card flat><Text fontSize={13.5} fontWeight="600" lineHeight={19} color={COLORS.eel}>{meeting.remarks}</Text></Card>

        {meeting.tagAlong ? (
          <XStack alignItems="flex-start" gap="$2" backgroundColor={COLORS.purpleSoft} borderRadius={14} padding="$3" marginTop="$3.5">
            <UsersIcon size={15} color={COLORS.purple} />
            <Text fontSize={12} fontWeight="700" color={COLORS.purple} flex={1} lineHeight={17}>
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
    <Card flexDirection="row" alignItems="center" gap="$3">
      <View width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={COLORS.greenTint}>
        <Text fontWeight="800" fontSize={16} color={COLORS.ledgeGreen}>{agentName?.split(' ').map((n) => n[0]).join('')}</Text>
      </View>
      <YStack>
        <Text fontWeight="800" fontSize={16} color={COLORS.eel}>{clientName}</Text>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Agent: {agentName}</Text>
      </YStack>
    </Card>
  );
}

function PhotoRow({ label, time }: { label: string; time?: string }) {
  return (
    <Card flat>
      <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
        <Check size={14} color={COLORS.ledgeGreen} />
        <Text fontSize={12.5} fontWeight="700" color={COLORS.eel}>Timestamp</Text>
        <Text fontSize={12.5} fontWeight="600" color={COLORS.hare}>{time}</Text>
      </XStack>
      <XStack alignItems="center" gap="$2.5" paddingVertical="$1.5">
        <View width={60} height={60} borderRadius={12} backgroundColor={COLORS.swan} alignItems="center" justifyContent="center">
          <Camera size={22} color={COLORS.wolf} />
        </View>
        <YStack>
          <Text fontSize={12} fontWeight="800" color={COLORS.eel}>{label}</Text>
          <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>Locked</Text>
        </YStack>
      </XStack>
    </Card>
  );
}

function DetailRow({ icon, label, extra, last }: { icon: React.ReactNode; label: string; extra?: string; last?: boolean }) {
  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      paddingVertical={9}
      borderBottomWidth={last ? 0 : 2}
      borderBottomColor={COLORS.polar}
    >
      <View width={22} height={22} borderRadius={11} backgroundColor={COLORS.feather} alignItems="center" justifyContent="center">
        {icon}
      </View>
      <Text fontSize={13.5} fontWeight="700" color={COLORS.eel} flex={1}>{label}</Text>
      {extra ? <Text fontSize={12.5} fontWeight="600" color={COLORS.hare}>{extra}</Text> : null}
    </XStack>
  );
}
