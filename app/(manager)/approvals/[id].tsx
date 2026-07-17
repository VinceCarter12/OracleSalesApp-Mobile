import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { Text, YStack, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, OUTCOME_BADGE_STYLES } from '../../../lib/theme';
import { agentById, clientById } from '../../../lib/manager-data';
import { useManagerStore } from '../../../lib/manager-store';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { MANAGER_OUTCOME_LABELS } from '../../../types';

/** Wireframe s-approvaldetail — diff view + Approve/Reject. */
export default function ApprovalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { approvals, meetings, decideApproval } = useManagerStore();
  const approval = approvals.find((a) => a.id === id);

  if (!approval) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Approval Detail" />
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Wala nang approval — na-decide na ito.</Text>
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
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Approval Detail" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <BizCard>
            <StatusBadge label="Tag-along meeting" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.brand} />
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text} marginTop="$2">{client?.name}</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={2}>
              Sinubmit ni {agent?.name} · {approval.requested}
            </Text>
          </BizCard>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2.5" lineHeight={19}>
            Iisang record lang ito na si {agent?.name} mismo ang gumawa. Ikaw bilang tag-along ay lumitaw sa litrato
            niya bilang proof — wala kang sariling record na kailangang gawin, review + approve/reject na lang.
          </Text>

          {outcomeLabel && outcomeStyle ? (
            <>
              <BizSectionHeader title="Outcome" />
              <StatusBadge label={outcomeLabel} background={outcomeStyle.background} color={outcomeStyle.color} />
            </>
          ) : null}

          <BizSectionHeader title="Meeting proof" />
          <BizCard flat>
            <XStack alignItems="center" gap="$2.5">
              <YStack width={60} height={60} borderRadius={16} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
                <Camera size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              </YStack>
              <YStack>
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={12.5} color={BIZLINK_COLORS.text}>Meeting photo</Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  Kasama si {meeting?.tagAlongManagerName ?? '—'} sa litrato
                </Text>
              </YStack>
            </XStack>
          </BizCard>

          {meeting?.remarks ? (
            <>
              <BizSectionHeader title="Remarks" />
              <BizCard flat><Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} lineHeight={19} color={BIZLINK_COLORS.text}>{meeting.remarks}</Text></BizCard>
            </>
          ) : null}

          <XStack gap="$2.5" marginTop="$5">
            <BizButton label="Reject" variant="white" onPress={() => decide(false)} style={{ flex: 1 }} />
            <BizButton label="Approve" onPress={() => decide(true)} style={{ flex: 1 }} />
          </XStack>
        </ScrollView>
      </YStack>
    );
  }

  const diffLabel = approval.type === 'edit' ? approval.field : 'Agent change';
  const fromLabel = approval.type === 'edit' ? approval.from : agent?.name;
  const toLabel = approval.type === 'edit' ? approval.to : agentById(approval.toAgentId!)?.name;
  const badge = approval.type === 'edit'
    ? { label: 'Edit request', background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.navy }
    : { label: 'Reassignment', background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.navy };

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Approval Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard>
          <StatusBadge {...badge} />
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text} marginTop="$2">{client?.name}</Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={2}>
            Requested by {agent?.name} · {approval.requested}
          </Text>
        </BizCard>

        <BizSectionHeader title={diffLabel ?? ''} />
        <XStack alignItems="center" gap="$2.5" backgroundColor={BIZLINK_COLORS.soft} borderRadius={16} padding={14}>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted} textDecorationLine="line-through">{fromLabel}</Text>
          <Text color={BIZLINK_COLORS.muted}>→</Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{toLabel}</Text>
        </XStack>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2" lineHeight={19}>
          {approval.type === 'edit'
            ? 'Ang edit na ito ay mananatiling pending hanggang sa desisyon mo. Once approved, agad itong ma-a-apply sa client record.'
            : 'Ang reassignment ay mangangahulugan ng paglipat ng buong client record patungo sa bagong agent kapag na-approve.'}
        </Text>

        <XStack gap="$2.5" marginTop="$5">
          <BizButton label="Reject" variant="white" onPress={() => decide(false)} style={{ flex: 1 }} />
          <BizButton label="Approve" onPress={() => decide(true)} style={{ flex: 1 }} />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
