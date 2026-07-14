import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CircleCheckBig, Handshake, TriangleAlert } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
import { agentById, clientById } from '../../lib/manager-data';
import { useManagerStore } from '../../lib/manager-store';
import { DuoButton } from '../../components/ui/DuoButton';
import { StatusBadge } from '../../components/ui/StatusBadge';

/**
 * Wireframe s-tagalong — ungated: accept/decline only, the sales rep still
 * owns and records the meeting (Meeting-2026-07-08, final single-owner model).
 */
export default function TagAlongRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { tagAlongRequests, approvals, acceptTagAlong, declineTagAlong } = useManagerStore();
  const pendingTagAlongApprovals = approvals.filter((a) => a.type === 'tagalong');

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>Tag-Along Requests</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3" lineHeight={19}>
          Hindi ka na gumagawa ng sariling meeting record. Ang sales rep ang nagre-record ng buong client visit
          (kasama ka sa litrato niya bilang proof) — dito mo lang ito ta-tanggapin o tatanggihan bago ang meeting, at
          ia-approve o irereject pagkatapos.
        </Text>
        <XStack gap="$2" backgroundColor={COLORS.amberSoft} borderRadius={12} padding="$3" marginBottom="$3.5">
          <TriangleAlert size={16} color={COLORS.orange} />
          <Text fontSize={11.5} fontWeight="600" color="#8C6A2E" flex={1} lineHeight={17}>
            Open question (ADR-014, 2026-07-09): ngayong hiwalay na ang Sales Manager at RSR Manager, dapat bang
            same-track lang ang tag-along invitee (Sales agent → Sales Manager lang) o kahit sinong manager pa rin?
            Hindi pa natatanong sa client — "kahit sinong manager" pa rin ang assumption sa demo na ito.
          </Text>
        </XStack>

        <SectionLabel title="Mga request — tanggapin bago ang meeting" />
        {tagAlongRequests.length === 0 ? (
          <EmptyState label="Walang naghihintay na request." />
        ) : (
          tagAlongRequests.map((r) => {
            const agent = agentById(r.agentId);
            const client = clientById(r.clientId);
            return (
              <YStack key={r.id} backgroundColor={COLORS.snow} borderWidth={2} borderColor={COLORS.swan} borderRadius={16} padding="$3.5" marginBottom="$2.5">
                <StatusBadge label="Tag-along request" background={COLORS.amberSoft} color={COLORS.orange} />
                <Text fontWeight="800" fontSize={14} color={COLORS.eel} marginTop="$2">{client?.name}</Text>
                <Text fontSize={12.5} fontWeight="600" color={COLORS.hare} marginTop={2} marginBottom={6}>
                  Kasama sana kita: <Text color={COLORS.eel} fontWeight="800">{agent?.name}</Text>
                </Text>
                <Text fontSize={12.5} fontWeight="600" color={COLORS.wolf}>{r.note}</Text>
                <XStack gap="$2" marginTop="$3">
                  <DuoButton label="Decline" variant="white" small onPress={() => declineTagAlong(r.id)} style={{ flex: 1 }} />
                  <DuoButton label="Accept" small onPress={() => acceptTagAlong(r.id)} style={{ flex: 1 }} />
                </XStack>
              </YStack>
            );
          })
        )}

        <SectionLabel title="Mga natapos na meeting — kailangan ng approval mo" />
        <Text fontSize={12} fontWeight="600" color={COLORS.hare} marginBottom="$2">Makikita rin ito sa Approvals tab.</Text>
        {pendingTagAlongApprovals.length === 0 ? (
          <EmptyState icon={<Handshake size={28} color={COLORS.hare} />} label="Walang tag-along meeting na naghihintay ng approval." />
        ) : (
          pendingTagAlongApprovals.map((a) => {
            const client = clientById(a.clientId);
            const agent = agentById(a.agentId);
            return (
              <XStack
                key={a.id}
                alignItems="center"
                gap="$3"
                paddingVertical={13}
                borderBottomWidth={2}
                borderBottomColor={COLORS.polar}
                onPress={() => router.push('/(manager)/approvals')}
              >
                <YStack flex={1}>
                  <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client?.name}</Text>
                  <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>{agent?.name} · {a.requested}</Text>
                </YStack>
                <StatusBadge label="Pending approval" background={COLORS.greenTint} color={COLORS.ledgeGreen} />
              </XStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text fontSize={16} fontWeight="800" color={COLORS.eel} marginTop="$4" marginBottom="$2">{title}</Text>
  );
}

function EmptyState({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <YStack alignItems="center" paddingVertical="$5" gap="$2">
      {icon ?? <CircleCheckBig size={28} color={COLORS.hare} />}
      <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center">{label}</Text>
    </YStack>
  );
}
