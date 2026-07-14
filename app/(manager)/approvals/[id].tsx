import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS, OUTCOME_BADGE_STYLES } from '../../../lib/theme';
import { agentById, clientById } from '../../../lib/manager-data';
import { useManagerStore } from '../../../lib/manager-store';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { DuoButton } from '../../../components/ui/DuoButton';
import { MANAGER_OUTCOME_LABELS } from '../../../types';

/** Wireframe s-approvaldetail — diff view + Approve/Reject. */
export default function ApprovalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { approvals, meetings, decideApproval } = useManagerStore();
  const approval = approvals.find((a) => a.id === id);

  if (!approval) {
    return (
      <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
        <TopBar title="Approval Detail" />
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Wala nang approval — na-decide na ito.</Text>
        </YStack>
      </YStack>
    );
  }

  const client = clientById(approval.clientId);
  const agent = agentById(approval.agentId);

  function decide(approve: boolean): void {
    decideApproval(approval!.id, approve);
    router.back();
  }

  if (approval.type === 'tagalong') {
    const meeting = approval.meetingId ? meetings.find((m) => m.id === approval.meetingId) : undefined;
    const outcomeLabel = meeting?.outcome ? MANAGER_OUTCOME_LABELS[meeting.outcome] : null;
    const outcomeStyle = outcomeLabel ? OUTCOME_BADGE_STYLES[outcomeLabel] : null;
    return (
      <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
        <TopBar title="Approval Detail" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <Card>
            <StatusBadge label="Tag-along meeting" background={COLORS.greenTint} color={COLORS.ledgeGreen} />
            <Text fontWeight="800" fontSize={17} color={COLORS.eel} marginTop="$2">{client?.name}</Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop={2}>
              Sinubmit ni {agent?.name} · {approval.requested}
            </Text>
          </Card>
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop="$2.5" lineHeight={19}>
            Iisang record lang ito na si {agent?.name} mismo ang gumawa. Ikaw bilang tag-along ay lumitaw sa litrato
            niya bilang proof — wala kang sariling record na kailangang gawin, review + approve/reject na lang.
          </Text>

          {outcomeLabel && outcomeStyle ? (
            <>
              <SectionHeader title="Outcome" />
              <StatusBadge label={outcomeLabel} background={outcomeStyle.background} color={outcomeStyle.color} />
            </>
          ) : null}

          <SectionHeader title="Meeting proof" />
          <Card flat>
            <XStack alignItems="center" gap="$2.5">
              <View width={60} height={60} borderRadius={12} backgroundColor={COLORS.swan} alignItems="center" justifyContent="center">
                <Camera size={22} color={COLORS.wolf} />
              </View>
              <YStack>
                <Text fontWeight="800" fontSize={12.5} color={COLORS.eel}>Meeting photo</Text>
                <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
                  Kasama si {meeting?.tagAlongManagerName ?? '—'} sa litrato
                </Text>
              </YStack>
            </XStack>
          </Card>

          {meeting?.remarks ? (
            <>
              <SectionHeader title="Remarks" />
              <Card flat><Text fontSize={13.5} fontWeight="600" lineHeight={19} color={COLORS.eel}>{meeting.remarks}</Text></Card>
            </>
          ) : null}

          <XStack gap="$2.5" marginTop="$5">
            <DuoButton label="Reject" variant="white" onPress={() => decide(false)} style={{ flex: 1 }} />
            <DuoButton label="Approve" onPress={() => decide(true)} style={{ flex: 1 }} />
          </XStack>
        </ScrollView>
      </YStack>
    );
  }

  const diffLabel = approval.type === 'edit' ? approval.field : 'Agent change';
  const fromLabel = approval.type === 'edit' ? approval.from : agent?.name;
  const toLabel = approval.type === 'edit' ? approval.to : agentById(approval.toAgentId!)?.name;
  const badge = approval.type === 'edit'
    ? { label: 'Edit request', background: COLORS.purpleSoft, color: COLORS.purple }
    : { label: 'Reassignment', background: COLORS.blueSoft, color: COLORS.blue };

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Approval Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card>
          <StatusBadge {...badge} />
          <Text fontWeight="800" fontSize={17} color={COLORS.eel} marginTop="$2">{client?.name}</Text>
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop={2}>
            Requested by {agent?.name} · {approval.requested}
          </Text>
        </Card>

        <SectionHeader title={diffLabel ?? ''} />
        <XStack alignItems="center" gap="$2.5" backgroundColor={COLORS.polar} borderRadius={12} padding="$3">
          <Text fontSize={13} fontWeight="700" color={COLORS.hare} textDecorationLine="line-through">{fromLabel}</Text>
          <Text color={COLORS.hare}>→</Text>
          <Text fontSize={13} fontWeight="800" color={COLORS.ledgeGreen}>{toLabel}</Text>
        </XStack>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop="$2" lineHeight={19}>
          {approval.type === 'edit'
            ? 'Ang edit na ito ay mananatiling pending hanggang sa desisyon mo. Once approved, agad itong ma-a-apply sa client record.'
            : 'Ang reassignment ay mangangahulugan ng paglipat ng buong client record patungo sa bagong agent kapag na-approve.'}
        </Text>

        <XStack gap="$2.5" marginTop="$5">
          <DuoButton label="Reject" variant="white" onPress={() => decide(false)} style={{ flex: 1 }} />
          <DuoButton label="Approve" onPress={() => decide(true)} style={{ flex: 1 }} />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
