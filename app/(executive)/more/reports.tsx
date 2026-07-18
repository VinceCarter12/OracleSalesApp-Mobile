import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { EXEC_LOST_OPP, EXEC_MANAGERS } from '../../../lib/executive-data';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
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
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Reports" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginBottom="$2">Timeframe</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$3.5">
          {TIMEFRAMES.map((t) => (
            <BizChip key={t} label={t} selected={timeframe === t} onPress={() => setTimeframe(t)} />
          ))}
        </XStack>

        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginBottom="$2">Team</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$4">
          <BizChip label="Buong kumpanya" selected={teamFilter === 'all'} onPress={() => setTeamFilter('all')} />
          {EXEC_MANAGERS.map((m) => (
            <BizChip
              key={m.id}
              label={`${m.name.split(' ')[0]}'s team`}
              selected={teamFilter === m.id}
              onPress={() => setTeamFilter(m.id)}
            />
          ))}
        </XStack>

        <BizCard>
          <StatListRow label="Total meetings" value={totalMeetings} />
          <StatListRow label="Successful" value={89} color={BIZLINK_COLORS.brand} />
          <StatListRow label="New clients acquired" value={14} color={BIZLINK_COLORS.navy} />
          <StatListRow label="Lost opportunities" value={EXEC_LOST_OPP.length} color={BIZLINK_COLORS.red} last />
        </BizCard>

        <YStack marginTop="$4">
          <BizButton
            label="Download Excel (All)"
            variant="brand"
            icon={<Download size={15} color={BIZLINK_COLORS.card} strokeWidth={1.75} />}
            onPress={() => showToast('Report generated — Excel download simulated')}
          />
        </YStack>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$2.5" lineHeight={18}>
          Tanging Executive ang makaka-download ng report ng BUONG kumpanya sa isang beses.
        </Text>
      </ScrollView>
    </YStack>
  );
}
