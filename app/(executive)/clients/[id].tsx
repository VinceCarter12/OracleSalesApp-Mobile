import { Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Eye } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../lib/client-status';
import {
  computeExecClientProgress,
  execAgentById,
  execClientById,
  execManagerById,
  execMeetingsForClient,
  type ExecClientChecklist,
} from '../../../lib/executive-data';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { TopBar } from '../../../components/ui/TopBar';
import { LockButton } from '../../../components/security/LockButton';
import { Card } from '../../../components/ui/Card';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { execOutcomeBadge } from '../../../components/executive/exec-badges';

const CHECKLIST_ITEMS: Array<[keyof ExecClientChecklist, string]> = [
  ['name', 'Company name'],
  ['contact', 'Contact person + position'],
  ['number', 'Contact number'],
  ['address', 'Office address'],
  ['channel', 'Sales channel'],
];

/** Wireframe x-detail — gated, view-only client detail: progress % (B-001), checklist, meeting history. */
export default function ExecutiveClientDetailScreen() {
  const { unlocked } = useGate();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!unlocked) return <SecurityGate />;

  const client = execClientById(id);
  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Text>Client not found.</Text>
      </YStack>
    );
  }

  const agent = execAgentById(client.agentId);
  const manager = execManagerById(client.managerId);
  const progress = computeExecClientProgress(client);
  const meetings = execMeetingsForClient(client.id);
  const badge = CLIENT_STATUS_BADGES[client.status];

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Client" right={<LockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3.5">
          <View
            width={70}
            height={70}
            borderRadius={35}
            borderWidth={7}
            borderColor={progress === 100 ? COLORS.feather : COLORS.swan}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontWeight="800" fontSize={16} color={COLORS.eel}>{progress}%</Text>
          </View>
          <YStack flex={1} gap="$1.5">
            <Text fontWeight="800" fontSize={17} color={COLORS.eel} lineHeight={20}>{client.name}</Text>
            <XStack gap="$1.5" flexWrap="wrap">
              <StatusBadge {...badge} />
              <StatusBadge label={client.channel} background={COLORS.polar} color={COLORS.wolf} />
            </XStack>
            <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
              Manager: <Text color={COLORS.eel} fontWeight="800">{manager?.name ?? '—'}</Text> · Agent:{' '}
              <Text color={COLORS.eel} fontWeight="800">{agent?.name ?? '—'}</Text>
            </Text>
          </YStack>
        </Card>

        <SectionHeader title="Info completion" />
        <Text fontSize={12} fontWeight="600" color={COLORS.hare} marginTop={-8} marginBottom={10} lineHeight={17}>
          Para lang ito sa 1-month data-quality rule — hiwalay na sa progress % sa taas (B-001).
        </Text>
        <Card>
          {CHECKLIST_ITEMS.map(([key, label]) => {
            const done = client.checklist[key];
            return (
              <XStack key={key} alignItems="center" gap="$2.5" paddingVertical={7}>
                <View
                  width={22}
                  height={22}
                  borderRadius={11}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={done ? COLORS.greenSoft : COLORS.polar}
                >
                  <Text fontSize={12} fontWeight="800" color={done ? COLORS.ledgeGreen : COLORS.hare}>
                    {done ? '✓' : '○'}
                  </Text>
                </View>
                <Text fontSize={13.5} fontWeight="700" color={done ? COLORS.eel : COLORS.hare}>{label}</Text>
              </XStack>
            );
          })}
        </Card>

        <SectionHeader title="Meeting history" />
        {meetings.length === 0 ? (
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} paddingVertical="$3">Wala pang meeting.</Text>
        ) : null}
        {meetings.map((meeting) => (
          <Pressable key={meeting.id} onPress={() => router.push(`/(executive)/clients/meeting/${meeting.id}`)}>
            <XStack alignItems="center" gap="$3" paddingVertical={13} borderBottomWidth={2} borderBottomColor={COLORS.polar}>
              <View width={38} height={38} borderRadius={19} alignItems="center" justifyContent="center" backgroundColor={COLORS.polar}>
                <Calendar size={15} color={COLORS.wolf} />
              </View>
              <YStack flex={1} gap="$0.5">
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{meeting.date} · {meeting.time}</Text>
                <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{meeting.location}</Text>
              </YStack>
              {execOutcomeBadge(meeting.outcome)}
              <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
            </XStack>
          </Pressable>
        ))}

        <XStack alignItems="center" justifyContent="center" gap="$1.5" paddingVertical="$3.5">
          <Eye size={13} color={COLORS.hare} />
          <Text fontSize={12} fontWeight="600" color={COLORS.hare}>
            View-only — ang pag-edit/approve ay nasa manager pa rin.
          </Text>
        </XStack>
      </ScrollView>
    </YStack>
  );
}
