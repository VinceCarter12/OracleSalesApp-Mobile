import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useExecutiveOverview } from '../../../lib/use-executive-overview';
import {
  countNewClientsAcquired,
  filterMeetingsByTimeframe,
  type ReportTimeframe,
} from '../../../lib/report-timeframe';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
import { StatListRow } from '../../../components/ui/StatListRow';
import { showToast } from '../../../lib/toast';

const TIMEFRAMES: ReportTimeframe[] = ['This month', 'Last 30 days', 'This quarter', 'Custom'];

/**
 * Wireframe x-reports — company-wide summary; tanging Executive ang maka-
 * download ng LAHAT. Real data (B-060 addendum to B-054 Phase 2).
 * Quality-gate fix (2026-07-22): all four stats now scope to the selected
 * Timeframe chip via `filterMeetingsByTimeframe()` — previously "Total
 * meetings"/"Successful"/"Lost opportunities" were always all-time
 * (`overview.meetings.length` / a company-wide `totals.lostCompanyWide`
 * unrelated to any meeting outcome) while only "New clients acquired" was
 * timeframe-scoped. "Lost opportunities" now counts timeframe-scoped meeting
 * rows with `outcome === 'lost'`, same convention as the Manager screen,
 * since `ExecClient` carries no separate lost-transition timestamp to scope
 * `totals.lostCompanyWide` by.
 */
export default function ExecutiveReportsScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useExecutiveOverview();
  const [timeframe, setTimeframe] = useState<ReportTimeframe>(TIMEFRAMES[0]);
  const [teamFilter, setTeamFilter] = useState<'all' | string>('all');

  const filteredMeetings = useMemo(() => {
    if (!overview) return [];
    return filterMeetingsByTimeframe(overview.meetings, timeframe, new Date());
  }, [overview, timeframe]);

  const successful = filteredMeetings.filter((m) => m.outcome === 'success').length;
  const lost = filteredMeetings.filter((m) => m.outcome === 'lost').length;

  const newClientsAcquired = useMemo(() => {
    if (!overview) return 0;
    return countNewClientsAcquired(overview.clients, timeframe, new Date());
  }, [overview, timeframe]);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Reports" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginBottom="$2">Timeframe</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom={timeframe === 'Custom' ? '$1.5' : '$3.5'}>
          {TIMEFRAMES.map((t) => (
            <BizChip key={t} label={t} selected={timeframe === t} onPress={() => setTimeframe(t)} />
          ))}
        </XStack>
        {timeframe === 'Custom' ? (
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3.5">
            Walang date range picker pa — pinapakita ang lahat ng oras (all-time).
          </Text>
        ) : null}

        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginBottom="$2">Team</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$4">
          <BizChip label="Buong kumpanya" selected={teamFilter === 'all'} onPress={() => setTeamFilter('all')} />
          {(overview?.managers ?? []).map((m) => (
            <BizChip
              key={m.id}
              label={`${m.name.split(' ')[0]}'s team`}
              selected={teamFilter === m.id}
              onPress={() => setTeamFilter(m.id)}
            />
          ))}
        </XStack>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {error}
            </Text>
            <BizButton small label="Ulitin" variant="white" onPress={reload} />
          </YStack>
        ) : (
          <BizCard>
            <StatListRow label="Total meetings" value={filteredMeetings.length} />
            <StatListRow label="Successful" value={successful} color={BIZLINK_COLORS.brand} />
            <StatListRow label="New clients acquired" value={newClientsAcquired} color={BIZLINK_COLORS.navy} />
            <StatListRow label="Lost opportunities (meetings)" value={lost} color={BIZLINK_COLORS.red} last />
          </BizCard>
        )}

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
