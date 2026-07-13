import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Download } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { getManagerAgents } from '../../../lib/manager-data';
import { useManagerStore } from '../../../lib/manager-store';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { SelectTile } from '../../../components/ui/SelectTile';
import { DuoButton } from '../../../components/ui/DuoButton';
import { StatListRow } from '../../../components/ui/StatListRow';
import { showToast } from '../../../lib/toast';

const TIMEFRAMES = ['This month', 'Last 30 days', 'This quarter', 'Custom'];

/** Wireframe s-reports — ungated: team-wide summary + Excel export, no customer contact info shown. */
export default function ManagerReportsScreen() {
  const { meetings } = useManagerStore();
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0]);
  const [agentFilter, setAgentFilter] = useState<'all' | string>('all');

  const successful = meetings.filter((m) => m.outcome === 'success').length;
  const lost = meetings.filter((m) => m.outcome === 'lost').length;

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Reports" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase" marginBottom="$2">Timeframe</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$3.5">
          {TIMEFRAMES.map((t) => (
            <SelectTile key={t} label={t} selected={timeframe === t} onPress={() => setTimeframe(t)} />
          ))}
        </XStack>

        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase" marginBottom="$2">Agent</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$4">
          <SelectTile label="Whole team" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
          {getManagerAgents().map((a) => (
            <SelectTile key={a.id} label={a.name} selected={agentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
          ))}
        </XStack>

        <Card>
          <StatListRow label="Total meetings" value={meetings.length} />
          <StatListRow label="Successful" value={successful} color={COLORS.ledgeGreen} />
          <StatListRow label="New clients acquired" value={7} color={COLORS.blue} />
          <StatListRow label="Lost opportunities" value={lost} color={COLORS.ledgeRed} last />
        </Card>

        <YStack marginTop="$4">
          <DuoButton
            label="Download Excel"
            variant="blue"
            icon={<Download size={15} color={COLORS.snow} />}
            onPress={() => showToast('Report generated — Excel download simulated')}
          />
        </YStack>
        <Text fontSize={12.5} fontWeight="600" color={COLORS.hare} textAlign="center" marginTop="$2.5" lineHeight={18}>
          Bilang manager, ma-download mo ang report ng BUONG TEAM. Admin lang ang makaka-download ng lahat ng agents
          company-wide. Walang customer contact info dito — buod/numero lang — kaya walang fingerprint na kailangan.
        </Text>
      </ScrollView>
    </YStack>
  );
}
