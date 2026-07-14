import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { EXEC_LOST_OPP, EXEC_MANAGERS } from '../../../lib/executive-data';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { SelectTile } from '../../../components/ui/SelectTile';
import { DuoButton } from '../../../components/ui/DuoButton';
import { StatListRow } from '../../../components/ui/StatListRow';
import { showToast } from '../../../lib/toast';

const TIMEFRAMES = ['This month', 'Last 30 days', 'This quarter', 'Custom'];

/** Wireframe x-reports — company-wide summary; tanging Executive ang maka-download ng LAHAT. */
export default function ExecutiveReportsScreen() {
  const insets = useSafeAreaInsets();
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0]);
  const [teamFilter, setTeamFilter] = useState<'all' | string>('all');

  const totalMeetings = EXEC_MANAGERS.reduce((sum, m) => sum + m.meetings, 0);

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Reports" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase" marginBottom="$2">Timeframe</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$3.5">
          {TIMEFRAMES.map((t) => (
            <SelectTile key={t} label={t} selected={timeframe === t} onPress={() => setTimeframe(t)} />
          ))}
        </XStack>

        <Text fontSize={10.5} fontWeight="800" color={COLORS.wolf} letterSpacing={0.6} textTransform="uppercase" marginBottom="$2">Team</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$4">
          <SelectTile label="Buong kumpanya" selected={teamFilter === 'all'} onPress={() => setTeamFilter('all')} />
          {EXEC_MANAGERS.map((m) => (
            <SelectTile
              key={m.id}
              label={`${m.name.split(' ')[0]}'s team`}
              selected={teamFilter === m.id}
              onPress={() => setTeamFilter(m.id)}
            />
          ))}
        </XStack>

        <Card>
          <StatListRow label="Total meetings" value={totalMeetings} />
          <StatListRow label="Successful" value={89} color={COLORS.ledgeGreen} />
          <StatListRow label="New clients acquired" value={14} color={COLORS.blue} />
          <StatListRow label="Lost opportunities" value={EXEC_LOST_OPP.length} color={COLORS.ledgeRed} last />
        </Card>

        <YStack marginTop="$4">
          <DuoButton
            label="Download Excel (All)"
            variant="blue"
            icon={<Download size={15} color={COLORS.snow} />}
            onPress={() => showToast('Report generated — Excel download simulated')}
          />
        </YStack>
        <Text fontSize={12.5} fontWeight="600" color={COLORS.hare} textAlign="center" marginTop="$2.5" lineHeight={18}>
          Tanging Executive ang makaka-download ng report ng BUONG kumpanya sa isang beses.
        </Text>
      </ScrollView>
    </YStack>
  );
}
