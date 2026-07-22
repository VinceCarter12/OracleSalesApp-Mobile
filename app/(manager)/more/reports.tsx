import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useTeamOverview } from '../../../lib/use-team-overview';
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
 * Wireframe s-reports — ungated: team-wide summary + Excel export, no
 * customer contact info shown. Real data (B-060 addendum to B-054 Phase 1).
 * Quality-gate fix (2026-07-22): all four stats now come from
 * `overview.meetings` (real Supabase read path), scoped to the selected
 * Timeframe chip via `filterMeetingsByTimeframe()` — previously "Total
 * meetings"/"Successful"/"Lost opportunities" silently read
 * `useManagerStore()`'s mock fixture meetings and ignored the Timeframe chip
 * entirely, while only "New clients acquired" was real and timeframe-scoped.
 */
export default function ManagerReportsScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useTeamOverview();
  const [timeframe, setTimeframe] = useState<ReportTimeframe>(TIMEFRAMES[0]);
  const [agentFilter, setAgentFilter] = useState<'all' | string>('all');

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

        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginBottom="$2">Agent</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$4">
          <BizChip label="Whole team" selected={agentFilter === 'all'} onPress={() => setAgentFilter('all')} />
          {(overview?.agents ?? []).map((a) => (
            <BizChip key={a.id} label={a.name} selected={agentFilter === a.id} onPress={() => setAgentFilter(a.id)} />
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
            <StatListRow label="Lost opportunities" value={lost} color={BIZLINK_COLORS.red} last />
          </BizCard>
        )}

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
