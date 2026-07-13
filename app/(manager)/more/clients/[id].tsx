import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Clock, Handshake, Repeat, Users as UsersIcon } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../../lib/client-status';
import { agentById, clientById, getTeamClientProgressBreakdown, meetingsForClient } from '../../../../lib/manager-data';
import { useManagerStore } from '../../../../lib/manager-store';
import { useGate } from '../../../../lib/gate-context';
import { SecurityGate } from '../../../../components/security/SecurityGate';
import { TopBar } from '../../../../components/ui/TopBar';
import { LockButton } from '../../../../components/security/LockButton';
import { Card } from '../../../../components/ui/Card';
import { ProgressRing } from '../../../../components/ui/ProgressRing';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { SectionHeader } from '../../../../components/ui/SectionHeader';
import { DuoButton } from '../../../../components/ui/DuoButton';
import { meetingBadge } from '../../../../lib/meeting-badge';

const CHECKLIST_LABELS: Record<string, string> = {
  name: 'Company name',
  contact: 'Contact person + position',
  number: 'Contact number',
  address: 'Office address',
  channel: 'Sales channel',
};

/** Wireframe s-detail — gated: progress ring, checklist, pending approval banner, meeting history, reassign. */
export default function ManagerClientDetailScreen() {
  const { unlocked } = useGate();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clients, meetings, approvals, decideApproval } = useManagerStore();

  if (!unlocked) return <SecurityGate />;

  const client = clients.find((c) => c.id === id) ?? clientById(id);
  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Text>Client not found.</Text>
      </YStack>
    );
  }

  const agent = agentById(client.agentId);
  const { presented, total } = getTeamClientProgressBreakdown(client, meetings);
  const progress = total;
  const clientMeetings = meetings.filter((m) => m.clientId === client.id);
  const pending = approvals.find((a) => a.clientId === client.id && a.type !== 'tagalong');

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Client" right={<LockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3.5">
          <ProgressRing percent={progress} />
          <YStack flex={1} gap="$1.5">
            <Text fontWeight="800" fontSize={17} color={COLORS.eel} lineHeight={20}>{client.name}</Text>
            <XStack gap="$1.5">
              <StatusBadge {...CLIENT_STATUS_BADGES[client.status]} />
              {client.channel !== '—' ? (
                <StatusBadge label={client.channel} background={COLORS.polar} color={COLORS.wolf} />
              ) : null}
            </XStack>
            <Text fontSize={12.5} fontWeight="600" color={COLORS.hare}>
              Agent: <Text color={COLORS.eel} fontWeight="800">{agent?.name}</Text>
            </Text>
            {/* States plainly that the ring is a Record Meeting -> Agenda
                outcome, not an info-completion score (B-001, corrected
                2026-07-11 — info completion has zero weight here). */}
            <StatusBadge
              label={presented ? 'Product presentation done (Record Meeting)' : 'Walang product presentation pa — 0%'}
              background={presented ? COLORS.greenTint : COLORS.polar}
              color={presented ? COLORS.ledgeGreen : COLORS.hare}
            />
          </YStack>
        </Card>

        <SectionHeader title="Info completion" helper={client.status === 'prospect' ? `· deadline: ${client.deadline}` : undefined} />
        <Text fontSize={12} fontWeight="600" color={COLORS.hare} marginTop={-6} marginBottom="$2">
          Para lang ito sa 1-month data-quality rule — hiwalay na sa progress % sa taas (B-001).
        </Text>
        <Card>
          {(Object.keys(CHECKLIST_LABELS) as (keyof typeof CHECKLIST_LABELS)[]).map((key, index, arr) => {
            const done = client.checklist[key as keyof typeof client.checklist];
            return (
              <XStack
                key={key}
                alignItems="center"
                gap="$2.5"
                paddingVertical={9}
                borderBottomWidth={index === arr.length - 1 ? 0 : 2}
                borderBottomColor={COLORS.polar}
              >
                <View width={22} height={22} borderRadius={11} backgroundColor={done ? COLORS.feather : COLORS.swan} alignItems="center" justifyContent="center">
                  {done ? <Text fontSize={11} fontWeight="800" color={COLORS.snow}>✓</Text> : null}
                </View>
                <Text fontSize={13.5} fontWeight="700" color={done ? COLORS.eel : COLORS.hare}>{CHECKLIST_LABELS[key]}</Text>
              </XStack>
            );
          })}
        </Card>

        {pending ? (
          <YStack backgroundColor={COLORS.amberSoft} borderWidth={2} borderColor="#D9B168" borderRadius={14} padding="$3" marginTop="$3">
            <XStack alignItems="center" gap="$2">
              <Clock size={15} color={COLORS.orange} />
              <Text fontSize={12} fontWeight="700" color={COLORS.orange} flex={1}>
                {pending.type === 'edit'
                  ? `May pending edit (${pending.field}: ${pending.from} → ${pending.to}) — hinihintay ang approval mo.`
                  : `May pending reassignment tungo kay ${agentById(pending.toAgentId!)?.name} — hinihintay ang approval mo.`}
              </Text>
            </XStack>
            <XStack gap="$2.5" marginTop="$2.5">
              <DuoButton label="Reject" variant="white" small onPress={() => decideApproval(pending.id, false)} style={{ flex: 1 }} />
              <DuoButton label="Approve" small onPress={() => decideApproval(pending.id, true)} style={{ flex: 1 }} />
            </XStack>
          </YStack>
        ) : null}

        <SectionHeader title="Meeting history" />
        {clientMeetings.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$5" gap="$2">
            <Handshake size={26} color={COLORS.hare} />
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Wala pang meeting na naitala.</Text>
          </YStack>
        ) : (
          clientMeetings.map((m) => (
            <XStack
              key={m.id}
              alignItems="center"
              gap="$3"
              paddingVertical={13}
              borderBottomWidth={2}
              borderBottomColor={COLORS.polar}
              onPress={() => router.push(`/(manager)/more/meetings/${m.id}`)}
            >
              <View width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={COLORS.polar}>
                <Calendar size={15} color={COLORS.wolf} />
              </View>
              <YStack flex={1}>
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{m.date} · {m.time}</Text>
                <XStack alignItems="center" gap="$1.5">
                  <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{m.location}</Text>
                  {m.tagAlong ? (
                    <XStack alignItems="center" gap="$0.5">
                      <UsersIcon size={10} color={COLORS.purple} />
                      <Text fontSize={10.5} fontWeight="800" color={COLORS.purple}>tag-along</Text>
                    </XStack>
                  ) : null}
                </XStack>
              </YStack>
              {meetingBadge(m)}
              {!m.synced ? <Text fontSize={11} fontWeight="800" color={COLORS.blue}>↻ pending</Text> : null}
            </XStack>
          ))
        )}

        <XStack marginTop="$4">
          <DuoButton
            label="Reassign Agent"
            variant="white"
            icon={<Repeat size={15} color={COLORS.eel} />}
            onPress={() => router.push(`/(manager)/more/clients/reassign?clientId=${client.id}`)}
          />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
