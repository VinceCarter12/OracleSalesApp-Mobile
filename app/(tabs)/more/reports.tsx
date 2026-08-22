import { useState } from 'react';
import { LayoutAnimation, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { useMeetings } from '../../../lib/useMeetings';
import { useClients } from '../../../lib/useClients';
import { useSession } from '../../../lib/session-store';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizStatCard } from '../../../components/bizlink/BizStatCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { CutoffQuotaCard } from '../../../components/cutoff/CutoffQuotaCard';
import { WeeklyMeetingsChart, WEEKDAY_LABELS, meetingsForWeekday } from '../../../components/reports/WeeklyMeetingsChart';
import { ResultMeetingRow, ResultClientRow } from '../../../components/reports/PerformanceResultRows';
import { FadeInPanel } from '../../../components/reports/FadeInPanel';
import type { Meeting } from '../../../types';
import type { CutoffQuotaRole } from '../../../lib/policies/cutoff-policy';

/** Drill-down selection driving the results panel below the stats/chart — only one active at a time. */
type PerformanceFilter =
  | { kind: 'month' }
  | { kind: 'successful' }
  | { kind: 'newClients' }
  | { kind: 'lost' }
  | { kind: 'day'; dayIndex: number };

const FILTER_TITLES: Record<PerformanceFilter['kind'], string> = {
  month: 'Meetings this month',
  successful: 'Successful meetings',
  newClients: 'Bagong clients',
  lost: 'Lost opportunities',
  day: 'Meetings',
};

/** Wireframe a-reports — My Performance: own stats only (managers see team-wide elsewhere). */
export default function MyPerformanceScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { meetings } = useMeetings();
  const { clients } = useClients();
  const { role, profileId } = useSession();
  // Managers carry a flat monthly target of their own as of 2026-08-16 (web
  // migration 105), so they see this card too. Narrowed rather than coerced —
  // the old ternary would have handed the card 'sales_specialist' for them.
  const quotaRole: CutoffQuotaRole | null =
    role === 'sales_specialist' || role === 'rsr' || role === 'sales_manager' ? role : null;
  const [filter, setFilter] = useState<PerformanceFilter | null>(null);

  const now = new Date();
  const thisMonth = meetings.filter((m) => {
    const d = new Date(m.logged_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const successfulMeetings = thisMonth.filter((m) => m.outcome === 'Successful');
  const lostMeetings = thisMonth.filter((m) => m.outcome === 'Lost Opportunity');
  const newClientsThisMonth = clients.filter((c) => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const rate = thisMonth.length > 0 ? Math.round((successfulMeetings.length / thisMonth.length) * 100) : 0;

  const isSameFilter = (a: PerformanceFilter, b: PerformanceFilter): boolean =>
    a.kind === 'day' && b.kind === 'day' ? a.dayIndex === b.dayIndex : a.kind === b.kind;

  const toggleFilter = (next: PerformanceFilter) => {
    // Smooths the panel's height change (opening/closing/switching selection)
    // instead of it snapping in — FadeInPanel below handles the panel's own
    // content fade/rise, this handles the surrounding layout shift.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter((current) => (current && isSameFilter(current, next) ? null : next));
  };

  const resultMeetings = ((): Meeting[] | null => {
    if (!filter) return null;
    switch (filter.kind) {
      case 'month':
        return thisMonth;
      case 'successful':
        return successfulMeetings;
      case 'lost':
        return lostMeetings;
      case 'day':
        return meetingsForWeekday(meetings, filter.dayIndex);
      case 'newClients':
        return null;
    }
  })();

  const resultClients = filter?.kind === 'newClients' ? newClientsThisMonth : null;
  const panelTitle = filter
    ? filter.kind === 'day'
      ? `${WEEKDAY_LABELS[filter.dayIndex]} — ${resultMeetings?.length ?? 0} meetings`
      : FILTER_TITLES[filter.kind]
    : null;
  // Replays FadeInPanel's entrance whenever the selection actually changes (not on every re-render).
  const panelKey = filter ? (filter.kind === 'day' ? `day-${filter.dayIndex}` : filter.kind) : null;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      {/* B-118: only ever reached cross-tab, straight from Home's "Performance"
          Quick Action — same pattern as its sibling manager/executive Reports
          screens, both of which already set this. */}
      <BizTopBar title="My Performance" fallbackHref="/(tabs)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <XStack flexWrap="wrap" gap={10}>
          <YStack width="48%">
            <BizStatCard
              tone="tintA"
              value={thisMonth.length}
              label="Meetings"
              caption="this month"
              minWidth={0}
              onPress={() => toggleFilter({ kind: 'month' })}
              selected={filter?.kind === 'month'}
            />
          </YStack>
          <YStack width="48%">
            <BizStatCard
              tone="white"
              value={successfulMeetings.length}
              label="Successful"
              caption={`${rate}% rate`}
              minWidth={0}
              onPress={() => toggleFilter({ kind: 'successful' })}
              selected={filter?.kind === 'successful'}
            />
          </YStack>
          <YStack width="48%">
            <BizStatCard
              tone="white"
              value={newClientsThisMonth.length}
              label="New clients"
              caption="acquired"
              minWidth={0}
              onPress={() => toggleFilter({ kind: 'newClients' })}
              selected={filter?.kind === 'newClients'}
            />
          </YStack>
          <YStack width="48%">
            <BizStatCard
              tone="tintB"
              value={lostMeetings.length}
              label="Lost opportunities"
              caption="bantayan"
              minWidth={0}
              onPress={() => toggleFilter({ kind: 'lost' })}
              selected={filter?.kind === 'lost'}
            />
          </YStack>
        </XStack>

        {quotaRole ? <CutoffQuotaCard agentId={profileId} role={quotaRole} /> : null}

        <WeeklyMeetingsChart
          meetings={meetings}
          selectedDay={filter?.kind === 'day' ? filter.dayIndex : null}
          onSelectDay={(dayIndex) => toggleFilter({ kind: 'day', dayIndex })}
        />

        {filter && panelTitle ? (
          <FadeInPanel key={panelKey}>
            <BizSectionHeader title={panelTitle} actionLabel="Clear" onAction={() => setFilter(null)} />
            {resultMeetings?.map((meeting) => (
              <ResultMeetingRow key={meeting.id} meeting={meeting} />
            ))}
            {resultClients?.map((client) => (
              <ResultClientRow key={client.id} client={client} />
            ))}
            {(resultMeetings?.length === 0 || resultClients?.length === 0) ? (
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">
                There's nothing here for this filter yet.
              </Text>
            ) : null}
          </FadeInPanel>
        ) : null}

        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$4">
          Your own performance only — other agents aren't included (that's for your manager).
        </Text>
      </ScrollView>
    </YStack>
  );
}
