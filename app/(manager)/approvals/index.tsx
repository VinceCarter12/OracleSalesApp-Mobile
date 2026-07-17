import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CircleCheckBig } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { agentById, clientById } from '../../../lib/manager-data';
import { useManagerStore } from '../../../lib/manager-store';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { ApprovalType } from '../../../types';

const TYPE_BADGE: Record<ApprovalType, { label: string; background: string; color: string }> = {
  edit: { label: 'Edit request', background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.navy },
  reassign: { label: 'Reassignment', background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.navy },
  tagalong: { label: 'Tag-along meeting', background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.brand },
};

/** Wireframe s-approvals — ungated: company name + diff only, no full contact info. */
export default function ApprovalsInboxScreen() {
  const insets = useSafeAreaInsets();
  const { approvals, meetings } = useManagerStore();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={21} color={BIZLINK_COLORS.text}>Approvals</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3">
          Client edit requests at reassignments na naghihintay ng approval mo bago maging final.
        </Text>
        {approvals.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$8" gap="$2">
            <CircleCheckBig size={36} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Wala nang naghihintay na approval — clear ka!</Text>
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
                backgroundColor={BIZLINK_COLORS.card}
                borderRadius={20}
                padding={16}
                marginBottom={10}
                onPress={() => router.push(`/(manager)/approvals/${a.id}`)}
              >
                <XStack alignItems="center" gap="$2" marginBottom="$1.5">
                  <StatusBadge {...badge} />
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginLeft="auto">{a.requested}</Text>
                </XStack>
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client?.name}</Text>
                <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={2} marginBottom={6}>
                  Requested by {agent?.name}
                </Text>
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{summary}</Text>
              </YStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
