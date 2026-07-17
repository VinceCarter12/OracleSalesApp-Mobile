import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Clock, Handshake, Repeat, Users as UsersIcon } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../../lib/client-status';
import { agentById, clientById, getTeamClientProgressBreakdown } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { ProgressRing } from '../../../../components/ui/ProgressRing';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { meetingBadge } from '../../../../lib/meeting-badge';

const CHECKLIST_LABELS: Record<string, string> = {
  name: 'Company name',
  contact: 'Contact person + position',
  number: 'Contact number',
  address: 'Office address',
  channel: 'Sales channel',
};

/**
 * Wireframe s-detail — progress ring, checklist, pending approval banner,
 * meeting history, reassign. The "Client info protection" passcode gate
 * (ADR-007) is removed for Manager per 2026-07-17 feedback (see ADR-007
 * follow-up note in Decisions.md) — content shows automatically.
 */
export default function ManagerClientDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clients, meetings, approvals, decideApproval } = useManagerStore();

  const client = clients.find((c) => c.id === id) ?? clientById(id);
  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Client not found.</Text>
      </YStack>
    );
  }

  const agent = agentById(client.agentId);
  const { presented, total } = getTeamClientProgressBreakdown(client, meetings);
  const progress = total;
  const clientMeetings = meetings.filter((m) => m.clientId === client.id);
  const pending = approvals.find((a) => a.clientId === client.id && a.type !== 'tagalong');

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Client" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flexDirection="row" alignItems="flex-start" gap="$3.5">
          <ProgressRing percent={progress} />
          <YStack flex={1} gap="$1.5">
            <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
              <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text} lineHeight={20} flex={1}>{client.name}</Text>
              <BizButton
                label="Reassign"
                variant="white"
                small
                icon={<Repeat size={14} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
                style={{ paddingHorizontal: 14 }}
                onPress={() => router.push(`/(manager)/more/clients/reassign?clientId=${client.id}`)}
              />
            </XStack>
            <XStack gap="$1.5">
              <StatusBadge {...CLIENT_STATUS_BADGES[client.status]} />
              {client.channel !== '—' ? (
                <StatusBadge label={client.channel} background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.muted} />
              ) : null}
            </XStack>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Agent: <Text color={BIZLINK_COLORS.text} fontFamily={BIZLINK_FONTS.semibold}>{agent?.name}</Text>
            </Text>
            {/* States plainly that the ring is a Record Meeting -> Agenda
                outcome, not an info-completion score (B-001, corrected
                2026-07-11 — info completion has zero weight here). */}
            <StatusBadge
              label={presented ? 'Product presentation done (Record Meeting)' : 'Walang product presentation pa — 0%'}
              background={presented ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft}
              color={presented ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted}
            />
          </YStack>
        </BizCard>

        <BizSectionHeader title="Info completion" helper={client.status === 'prospect' ? `· deadline: ${client.deadline}` : undefined} />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2">
          Para lang ito sa 1-month data-quality rule — hiwalay na sa progress % sa taas (B-001).
        </Text>
        <BizCard>
          {(Object.keys(CHECKLIST_LABELS) as (keyof typeof CHECKLIST_LABELS)[]).map((key, index, arr) => {
            const done = client.checklist[key as keyof typeof client.checklist];
            return (
              <XStack
                key={key}
                alignItems="center"
                gap="$2.5"
                paddingVertical={9}
                borderBottomWidth={index === arr.length - 1 ? 0 : 1}
                borderBottomColor={BIZLINK_COLORS.line}
              >
                <YStack width={22} height={22} borderRadius={11} backgroundColor={done ? BIZLINK_COLORS.brand : BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
                  {done ? <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>✓</Text> : null}
                </YStack>
                <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={done ? BIZLINK_COLORS.text : BIZLINK_COLORS.muted}>{CHECKLIST_LABELS[key]}</Text>
              </XStack>
            );
          })}
        </BizCard>

        {pending ? (
          <YStack backgroundColor={BIZLINK_COLORS.amberSoft} borderRadius={20} padding={14} marginTop="$3">
            <XStack alignItems="center" gap="$2">
              <Clock size={15} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange} flex={1}>
                {pending.type === 'edit'
                  ? `May pending edit (${pending.field}: ${pending.from} → ${pending.to}) — hinihintay ang approval mo.`
                  : `May pending reassignment tungo kay ${agentById(pending.toAgentId!)?.name} — hinihintay ang approval mo.`}
              </Text>
            </XStack>
            <XStack gap="$2.5" marginTop="$2.5">
              <BizButton label="Reject" variant="white" small onPress={() => decideApproval(pending.id, false)} style={{ flex: 1 }} />
              <BizButton label="Approve" small onPress={() => decideApproval(pending.id, true)} style={{ flex: 1 }} />
            </XStack>
          </YStack>
        ) : null}

        <BizSectionHeader title="Meeting history" />
        {clientMeetings.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$5" gap="$2">
            <Handshake size={26} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Wala pang meeting na naitala.</Text>
          </YStack>
        ) : (
          clientMeetings.map((m) => (
            <XStack
              key={m.id}
              alignItems="center"
              gap="$3"
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              padding={14}
              marginBottom={10}
              onPress={() => router.push(`/(manager)/more/meetings/${m.id}`)}
            >
              <YStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.soft}>
                <Calendar size={15} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              </YStack>
              <YStack flex={1}>
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{m.date} · {m.time}</Text>
                <XStack alignItems="center" gap="$1.5">
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{m.location}</Text>
                  {m.tagAlong ? (
                    <XStack alignItems="center" gap="$0.5">
                      <UsersIcon size={10} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
                      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.navy}>tag-along</Text>
                    </XStack>
                  ) : null}
                </XStack>
              </YStack>
              {meetingBadge(m)}
              {!m.synced ? <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.navy}>↻ pending</Text> : null}
            </XStack>
          ))
        )}
      </ScrollView>
    </YStack>
  );
}
