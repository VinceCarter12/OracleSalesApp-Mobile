import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { getManagerAgents } from '../../../lib/manager-data';
import { useManagerStore } from '../../../lib/manager-store';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
import { StatListRow } from '../../../components/ui/StatListRow';
import { showToast } from '../../../lib/toast';

const TIMEFRAMES = ['This month', 'Last 30 days', 'This quarter', 'Custom'];

/** Wireframe s-reports — ungated: team-wide summary + Excel export, no customer contact info shown. */
export default function ManagerReportsScreen() {
  const insets = useSafeAreaInsets();
  const { meetings } = useManagerStore();
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0]);
  const [agentFilter, setAgentFilter] = useState<'all' | string>('all');

  const successful = meetings.filter((m) => m.outcome === 'success').length;
  const lost = meetings.filter((m) => m.outcome === 'lost').length;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Reports" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginBottom="$2">Timeframe</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$3.5">
          {TIMEFRAMES.map((t) => (
            <BizChip key={t} label={t} selected={timeframe === t} onPress={() => setTimeframe(t)} />
          ))}
        </XStack>

        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginBottom="$2">Agent</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$4">
          <BizChip label="Whole team" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
          {getManagerAgents().map((a) => (
            <BizChip key={a.id} label={a.name} selected={agentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
          ))}
        </XStack>

        <BizCard>
          <StatListRow label="Total meetings" value={meetings.length} />
          <StatListRow label="Successful" value={successful} color={BIZLINK_COLORS.brand} />
          <StatListRow label="New clients acquired" value={7} color={BIZLINK_COLORS.navy} />
          <StatListRow label="Lost opportunities" value={lost} color={BIZLINK_COLORS.red} last />
        </BizCard>

        <YStack marginTop="$4">
          <BizButton
            label="Download Excel"
            variant="navy"
            icon={<Download size={15} color={BIZLINK_COLORS.card} strokeWidth={1.75} />}
            onPress={() => showToast('Report generated — Excel download simulated')}
          />
        </YStack>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$2.5" lineHeight={18}>
          Bilang manager, ma-download mo ang report ng BUONG TEAM. Admin lang ang makaka-download ng lahat ng agents
          company-wide. Walang customer contact info dito — buod/numero lang — kaya walang fingerprint na kailangan.
        </Text>
      </ScrollView>
    </YStack>
  );
}
