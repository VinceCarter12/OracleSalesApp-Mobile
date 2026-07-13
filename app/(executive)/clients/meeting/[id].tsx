import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../../lib/theme';
import { execAgentById, execClientById, execMeetingById } from '../../../../lib/executive-data';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { TopBar } from '../../../../components/ui/TopBar';
import { Card } from '../../../../components/ui/Card';
import { SectionHeader } from '../../../../components/ui/SectionHeader';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { execOutcomeBadge } from '../../../../components/executive/exec-badges';

/** Wireframe x-meetingdetail — gated, view-only: outcome, auto-captured proof, agenda, remarks. */
export default function ExecutiveMeetingDetailScreen() {
  const { unlocked } = useGate();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!unlocked) return <SecurityGate />;

  const meeting = execMeetingById(id);
  if (!meeting) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Text>Meeting not found.</Text>
      </YStack>
    );
  }

  const client = execClientById(meeting.clientId);
  const agent = execAgentById(meeting.agentId);

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Meeting Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3">
          <View width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={agent?.avatar.background ?? COLORS.polar}>
            <Text fontWeight="800" fontSize={15} color={agent?.avatar.color ?? COLORS.wolf}>{agent?.initials ?? '—'}</Text>
          </View>
          <YStack>
            <Text fontWeight="800" fontSize={16} color={COLORS.eel}>{client?.name ?? '—'}</Text>
            <Text fontSize={12.5} fontWeight="600" color={COLORS.hare}>Agent: {agent?.name ?? '—'}</Text>
          </YStack>
        </Card>

        <SectionHeader title="Outcome" />
        <XStack gap="$1.5" flexWrap="wrap">
          {execOutcomeBadge(meeting.outcome)}
          {meeting.synced ? (
            <StatusBadge label="Synced" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />
          ) : (
            <StatusBadge label="Pending sync" background={COLORS.blueSoft} color={COLORS.blue} />
          )}
        </XStack>

        <SectionHeader title="Auto-captured" />
        <Card flat gap="$2">
          <XStack alignItems="center" gap="$2">
            <Text fontSize={13} fontWeight="800" color={COLORS.ledgeGreen}>✓</Text>
            <Text fontSize={13} fontWeight="700" color={COLORS.eel}>GPS</Text>
            <Text fontSize={12} fontWeight="600" color={COLORS.hare}>{meeting.gps}</Text>
          </XStack>
          <XStack alignItems="center" gap="$2">
            <Text fontSize={13} fontWeight="800" color={COLORS.ledgeGreen}>✓</Text>
            <Text fontSize={13} fontWeight="700" color={COLORS.eel}>Date & time</Text>
            <Text fontSize={12} fontWeight="600" color={COLORS.hare}>{meeting.date} · {meeting.time}</Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5">
            <View width={44} height={44} borderRadius={12} borderWidth={2} borderColor={COLORS.swan} alignItems="center" justifyContent="center" backgroundColor={COLORS.snow}>
              <Camera size={17} color={COLORS.wolf} />
            </View>
            <Text fontSize={12.5} fontWeight="800" color={COLORS.eel}>Selfie captured</Text>
          </XStack>
        </Card>

        <SectionHeader title="Agenda" />
        <XStack gap="$1.5" flexWrap="wrap">
          {meeting.agenda.map((item) => (
            <StatusBadge key={item} label={item} background={COLORS.greenTint} color={COLORS.ledgeGreen} />
          ))}
        </XStack>

        <SectionHeader title="Remarks" />
        <Card flat>
          <Text fontSize={13.5} fontWeight="600" color={COLORS.eel} lineHeight={20}>{meeting.remarks}</Text>
        </Card>
      </ScrollView>
    </YStack>
  );
}
