import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { CircleCheckBig } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { agentById, clientById, meetingById } from '../../../lib/manager-data';
import { useManagerStore } from '../../../lib/manager-store';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { ApprovalType } from '../../../types';

const TYPE_BADGE: Record<ApprovalType, { label: string; background: string; color: string }> = {
  edit: { label: 'Edit request', background: COLORS.purpleSoft, color: COLORS.purple },
  reassign: { label: 'Reassignment', background: COLORS.blueSoft, color: COLORS.blue },
  tagalong: { label: 'Tag-along meeting', background: COLORS.greenTint, color: COLORS.ledgeGreen },
};

/** Wireframe s-approvals — ungated: company name + diff only, no full contact info. */
export default function ApprovalsInboxScreen() {
  const { approvals, meetings } = useManagerStore();

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>Approvals</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3">
          Client edit requests at reassignments na naghihintay ng approval mo bago maging final.
        </Text>
        {approvals.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$8" gap="$2">
            <CircleCheckBig size={36} color={COLORS.hare} />
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Wala nang naghihintay na approval — clear ka!</Text>
          </YStack>
        ) : (
          approvals.map((a) => {
            const client = clientById(a.clientId);
            const agent = agentById(a.agentId);
            const badge = TYPE_BADGE[a.type];
            let summary = '';
            if (a.type === 'edit') summary = `${a.field}: ${a.from} → ${a.to}`;
            else if (a.type === 'reassign') summary = `Reassign to ${agentById(a.toAgentId!)?.name}`;
            else {
              const meeting = a.meetingId ? meetings.find((m) => m.id === a.meetingId) : undefined;
              summary = `Meeting kasama si ${meeting?.tagAlongManagerName ?? '—'} — for review`;
            }
            return (
              <YStack
                key={a.id}
                backgroundColor={COLORS.snow}
                borderWidth={2}
                borderColor={COLORS.swan}
                borderRadius={16}
                padding="$3.5"
                marginBottom="$2.5"
                onPress={() => router.push(`/(manager)/approvals/${a.id}`)}
              >
                <XStack alignItems="center" gap="$2" marginBottom="$1.5">
                  <StatusBadge {...badge} />
                  <Text fontSize={11.5} fontWeight="700" color={COLORS.hare} marginLeft="auto">{a.requested}</Text>
                </XStack>
                <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client?.name}</Text>
                <Text fontSize={12} fontWeight="600" color={COLORS.hare} marginTop={2} marginBottom={6}>
                  Requested by {agent?.name}
                </Text>
                <Text fontSize={12.5} fontWeight="700" color={COLORS.eel}>{summary}</Text>
              </YStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
