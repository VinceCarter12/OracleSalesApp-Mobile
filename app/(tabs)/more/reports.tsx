import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { useMeetings } from '../../../lib/useMeetings';
import { useClients } from '../../../lib/useClients';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';

function StatRow({ label, value, color, last }: { label: string; value: number; color?: string; last?: boolean }) {
  return (
    <XStack
      paddingVertical={10}
      justifyContent="space-between"
      borderBottomWidth={last ? 0 : 2}
      borderBottomColor={COLORS.polar}
    >
      <Text fontSize={13} fontWeight="700" color={COLORS.eel}>{label}</Text>
      <Text fontSize={13} fontWeight="800" color={color ?? COLORS.eel}>{value}</Text>
    </XStack>
  );
}

/** Wireframe a-reports — My Performance: own stats only (managers see team-wide elsewhere). */
export default function MyPerformanceScreen() {
  const { meetings } = useMeetings();
  const { clients } = useClients();

  const now = new Date();
  const thisMonth = meetings.filter((m) => {
    const d = new Date(m.logged_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const successful = thisMonth.filter((m) => m.outcome === 'Successful').length;
  const newClients = clients.filter((c) => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const lost = thisMonth.filter((m) => m.outcome === 'Lost Opportunity').length;

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="My Performance" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card>
          <StatRow label="Meetings this month" value={thisMonth.length} />
          <StatRow label="Successful" value={successful} color={COLORS.ledgeGreen} />
          <StatRow label="New clients acquired" value={newClients} color={COLORS.blue} />
          <StatRow label="Lost opportunities" value={lost} color={COLORS.ledgeRed} last />
        </Card>
        <Text fontSize={12.5} fontWeight="600" color={COLORS.hare} textAlign="center" marginTop="$3">
          Sariling performance lang — hindi kasama ang ibang agents (yun ay para sa manager na).
        </Text>
      </ScrollView>
    </YStack>
  );
}
