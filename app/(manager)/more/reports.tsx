import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download, Search, SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_FONTS, BIZLINK_ON_INK, useBizlinkColors } from '../../../lib/theme';
import { KeyboardAwareScrollView } from '../../../components/ui/KeyboardAwareScrollView';
import { useTeamOverview } from '../../../lib/use-team-overview';
import { useSession } from '../../../lib/session-store';
import { countNewClientsAcquired, filterMeetingsByTimeframe, type ReportTimeframe } from '../../../lib/report-timeframe';
import {
  MANAGER_REPORT_CATEGORY_LABELS,
  MANAGER_REPORT_EXPORT_CATEGORIES,
  matchesManagerClientReportSearch,
  matchesManagerReportSearch,
  type ManagerReportExportCategory,
} from '../../../lib/manager-report-filter';
import { exportManagerReport } from '../../../lib/manager-report-export';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../../components/bizlink/BizFilterSheetRow';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizStatCard } from '../../../components/bizlink/BizStatCard';
import { FadeInPanel } from '../../../components/reports/FadeInPanel';
import { TeamResultClientRow, TeamResultMeetingRow } from '../../../components/reports/PerformanceResultRows';
import { WEEKDAY_LABELS, WeeklyMeetingsChart, meetingsForWeekday } from '../../../components/reports/WeeklyMeetingsChart';
import type { TeamClient, TeamMeeting } from '../../../types';

const TIMEFRAMES: ReportTimeframe[] = ['This month', 'Last 30 days', 'This quarter', 'Custom'];

type PerformanceFilter =
  | { kind: 'meetings' }
  | { kind: 'successful' }
  | { kind: 'newClients' }
  | { kind: 'lost' }
  | { kind: 'day'; dayIndex: number };

const FILTER_TITLES: Record<Exclude<PerformanceFilter['kind'], 'day'>, string> = {
  meetings: 'Total meetings',
  successful: 'Successful meetings',
  newClients: 'New clients acquired',
  lost: 'Lost opportunities',
};

/** Manager Reports: real team-scoped overview with searchable records and a
 * server-authorized workbook. The mobile payload only requests scope: the
 * Edge Function derives the manager's actual team from the access token. */
export default function ManagerReportsScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useTeamOverview();
  const { profileId, fullName } = useSession();
  const [timeframe, setTimeframe] = useState<ReportTimeframe>(TIMEFRAMES[0]);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportCategories, setExportCategories] = useState<ManagerReportExportCategory[]>([...MANAGER_REPORT_EXPORT_CATEGORIES]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter | null>(null);
  const [exporting, setExporting] = useState(false);

  // useTeamOverview's roster correctly excludes a manager, but Reports also
  // includes their own meetings. Add them to search/filter labels only.
  const agents = useMemo(() => {
    const teamAgents = overview?.agents ?? [];
    if (!profileId || !fullName || teamAgents.some((agent) => agent.id === profileId)) return teamAgents;
    return [...teamAgents, {
      id: profileId,
      name: fullName,
      initials: fullName.split(/\s+/).map((name) => name[0]).join('').slice(0, 2),
      meetingsThisMonth: 0,
      activeClients: 0,
      successRate: 0,
    }];
  }, [overview?.agents, profileId, fullName]);

  const filteredMeetings = useMemo(() => {
    if (!overview) return [];
    return filterMeetingsByTimeframe(overview.meetings, timeframe, new Date())
      .filter((meeting) => (agentIds.length === 0 || agentIds.includes(meeting.agentId))
        && matchesManagerReportSearch(searchQuery, meeting, overview.clients, agents));
  }, [overview, timeframe, agentIds, searchQuery, agents]);

  const teamMeetingsThisWeek = useMemo(
    () => overview?.meetings.filter((meeting) => (agentIds.length === 0 || agentIds.includes(meeting.agentId))
      && matchesManagerReportSearch(searchQuery, meeting, overview.clients, agents)) ?? [],
    [overview, agentIds, searchQuery, agents]
  );
  const successful = filteredMeetings.filter((meeting) => meeting.outcome === 'success').length;
  const lost = filteredMeetings.filter((meeting) => meeting.outcome === 'lost').length;
  const successRate = filteredMeetings.length ? Math.round((successful / filteredMeetings.length) * 100) : 0;

  const newClients = useMemo((): TeamClient[] => {
    if (!overview) return [];
    const scopedClients = agentIds.length === 0 ? overview.clients : overview.clients.filter((client) => agentIds.includes(client.agentId));
    return scopedClients.filter((client) => countNewClientsAcquired([client], timeframe, new Date()) === 1
      && matchesManagerClientReportSearch(searchQuery, client, agents));
  }, [overview, timeframe, agentIds, searchQuery, agents]);

  const togglePerformanceFilter = (next: PerformanceFilter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPerformanceFilter((current) => {
      const matches = current?.kind === next.kind && (next.kind !== 'day' || (current.kind === 'day' && current.dayIndex === next.dayIndex));
      return matches ? null : next;
    });
  };

  const resultMeetings: TeamMeeting[] | null = (() => {
    if (!performanceFilter) return null;
    switch (performanceFilter.kind) {
      case 'meetings': return filteredMeetings;
      case 'successful': return filteredMeetings.filter((meeting) => meeting.outcome === 'success');
      case 'lost': return filteredMeetings.filter((meeting) => meeting.outcome === 'lost');
      case 'day': return meetingsForWeekday(teamMeetingsThisWeek, performanceFilter.dayIndex);
      case 'newClients': return null;
    }
  })();
  const resultClients = performanceFilter?.kind === 'newClients' ? newClients : null;
  const panelTitle = performanceFilter
    ? performanceFilter.kind === 'day'
      ? `${WEEKDAY_LABELS[performanceFilter.dayIndex]} - ${resultMeetings?.length ?? 0} meetings`
      : FILTER_TITLES[performanceFilter.kind]
    : null;
  const panelKey = performanceFilter ? performanceFilter.kind === 'day' ? `day-${performanceFilter.dayIndex}` : performanceFilter.kind : null;

  const filtersActive = timeframe !== TIMEFRAMES[0] || agentIds.length > 0 || exportCategories.length !== MANAGER_REPORT_EXPORT_CATEGORIES.length;
  const selectedAgentsLabel = agentIds.length === 0
    ? 'Whole team'
    : agentIds.length === 1 ? agents.find((agent) => agent.id === agentIds[0])?.name ?? '1 user' : `${agentIds.length} users`;
  const selectedCategoriesLabel = exportCategories.length === MANAGER_REPORT_EXPORT_CATEGORIES.length
    ? 'All categories'
    : exportCategories.length === 0 ? 'None' : `${exportCategories.length} categories`;

  const resetFilters = () => {
    setTimeframe(TIMEFRAMES[0]);
    setAgentIds([]);
    setExportCategories([...MANAGER_REPORT_EXPORT_CATEGORIES]);
  };
  const toggleAgent = (agentId: string) => setAgentIds((current) => current.includes(agentId)
    ? current.filter((id) => id !== agentId) : [...current, agentId]);
  const toggleExportCategory = (category: ManagerReportExportCategory) => setExportCategories((current) => current.includes(category)
    ? current.filter((value) => value !== category) : [...current, category]);
  const handleExport = async () => {
    if (exportCategories.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportManagerReport({ timeframe, agentIds, categories: exportCategories, searchQuery: searchQuery.trim() });
      showToast('Excel report ready. Choose where to save or share it.');
    } catch (exportError) {
      showToast(exportError instanceof Error ? exportError.message : "The Excel report couldn't be generated. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Reports" fallbackHref="/(manager)" />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <XStack gap="$2" alignItems="center" marginBottom="$3">
          <XStack flex={1} alignItems="center" gap="$2" height={52} paddingHorizontal={12} backgroundColor={BIZLINK_COLORS.card} borderRadius={16} borderWidth={1} borderColor={BIZLINK_COLORS.line}>
            <Search size={17} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search agent or client..." placeholderTextColor={BIZLINK_COLORS.muted} autoCapitalize="words" autoCorrect={false} accessibilityLabel="Search report records by agent or client" style={{ flex: 1, color: BIZLINK_COLORS.text, fontFamily: BIZLINK_FONTS.medium, fontSize: 13 }} />
          </XStack>
          <Pressable accessibilityLabel="Toggle report filters" onPress={() => setFilterOpen((open) => !open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, borderRadius: 16, paddingHorizontal: 14, backgroundColor: filterOpen || filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.card, borderWidth: 1, borderColor: filterOpen || filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.line }}>
            <SlidersHorizontal size={16} color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={filterOpen || filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}>Filters</Text>
          </Pressable>
        </XStack>

        <BizFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
          <BizFilterSheetRow label="Timeframe" value={timeframe}>
            <XStack gap="$2" flexWrap="wrap">
              {TIMEFRAMES.map((value) => <BizChip key={value} label={value} selected={timeframe === value} onPress={() => setTimeframe(value)} />)}
            </XStack>
            {timeframe === 'Custom' ? <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2">No date range picker yet — Custom shows all time.</Text> : null}
          </BizFilterSheetRow>
          <BizFilterSheetRow label="Users" value={selectedAgentsLabel}>
            <XStack gap="$2" flexWrap="wrap">
              <BizChip label="Whole team" selected={agentIds.length === 0} onPress={() => setAgentIds([])} />
              {agents.map((agent) => <BizChip key={agent.id} label={agent.name} selected={agentIds.includes(agent.id)} onPress={() => toggleAgent(agent.id)} />)}
            </XStack>
          </BizFilterSheetRow>
          <BizFilterSheetRow label="Export categories" value={selectedCategoriesLabel}>
            <XStack gap="$2" flexWrap="wrap">
              {MANAGER_REPORT_EXPORT_CATEGORIES.map((category) => <BizChip key={category} label={MANAGER_REPORT_CATEGORY_LABELS[category]} selected={exportCategories.includes(category)} onPress={() => toggleExportCategory(category)} />)}
            </XStack>
            {exportCategories.length === 0 ? <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginTop="$2">Pick at least one category to export.</Text> : null}
          </BizFilterSheetRow>
        </BizFilterSheet>

        {loading ? <YStack alignItems="center" paddingVertical="$6"><Spinner size="large" color={BIZLINK_COLORS.brand} /></YStack>
          : error ? <YStack alignItems="center" paddingVertical="$6" gap="$3"><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text><BizButton small label="Ulitin" variant="white" onPress={reload} /></YStack>
            : <>
                <XStack flexWrap="wrap" gap={10}>
                  <YStack width="48%"><BizStatCard tone="tintA" value={filteredMeetings.length} label="Total meetings" caption={timeframe.toLowerCase()} minWidth={0} onPress={() => togglePerformanceFilter({ kind: 'meetings' })} selected={performanceFilter?.kind === 'meetings'} /></YStack>
                  <YStack width="48%"><BizStatCard tone="white" value={successful} label="Successful" caption={`${successRate}% rate`} minWidth={0} onPress={() => togglePerformanceFilter({ kind: 'successful' })} selected={performanceFilter?.kind === 'successful'} /></YStack>
                  <YStack width="48%"><BizStatCard tone="white" value={newClients.length} label="New clients acquired" caption="acquired" minWidth={0} onPress={() => togglePerformanceFilter({ kind: 'newClients' })} selected={performanceFilter?.kind === 'newClients'} /></YStack>
                  <YStack width="48%"><BizStatCard tone="tintB" value={lost} label="Lost opportunities" caption="watch" minWidth={0} onPress={() => togglePerformanceFilter({ kind: 'lost' })} selected={performanceFilter?.kind === 'lost'} /></YStack>
                </XStack>
                <WeeklyMeetingsChart title="Team meetings this week" meetings={teamMeetingsThisWeek} selectedDay={performanceFilter?.kind === 'day' ? performanceFilter.dayIndex : null} onSelectDay={(dayIndex) => togglePerformanceFilter({ kind: 'day', dayIndex })} />
                {performanceFilter && panelTitle ? <FadeInPanel key={panelKey}><BizSectionHeader title={panelTitle} actionLabel="Clear" onAction={() => setPerformanceFilter(null)} />{resultMeetings?.map((meeting) => <TeamResultMeetingRow key={meeting.id} meeting={meeting} clientName={overview?.clients.find((client) => client.id === meeting.clientId)?.name ?? 'Unknown Client'} />)}{resultClients?.map((client) => <TeamResultClientRow key={client.id} client={client} />)}{(resultMeetings?.length === 0 || resultClients?.length === 0) ? <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">Nothing here yet.</Text> : null}</FadeInPanel> : null}
              </>}

        <YStack marginTop="$4">
          <BizButton label={exporting ? 'Generating Excel...' : 'Export current report'} variant="navy" icon={<Download size={15} color={BIZLINK_COLORS.card} strokeWidth={1.75} />} onPress={handleExport} disabled={loading || exporting || exportCategories.length === 0} />
        </YStack>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$2.5" lineHeight={18}>
          {selectedAgentsLabel} · {timeframe} · {selectedCategoriesLabel}. Team records only, no customer contact info.
        </Text>
      </KeyboardAwareScrollView>
    </YStack>
  );
}
