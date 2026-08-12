import { useMemo, useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download, Share2 } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useExecutiveOverview } from '../../../lib/use-executive-overview';
import {
  countNewClientsAcquired,
  filterMeetingsByTimeframe,
  type CustomDateRange,
  type ReportTimeframe,
} from '../../../lib/report-timeframe';
import { exportReportCsv, saveReportCsv, type ReportExportInput, type ReportExportRow } from '../../../lib/report-export';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
import { StatListRow } from '../../../components/ui/StatListRow';
import { showToast } from '../../../lib/toast';

const TIMEFRAMES: ReportTimeframe[] = ['This month', 'Last 30 days', 'This quarter', 'Custom'];

/** Parses a strict `YYYY-MM-DD` string to a local Date, rejecting malformed or overflow dates (e.g. `2026-02-31`). Returns `null` for empty/invalid input. */
function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d] = match;
  const year = Number(y);
  const month = Number(mo) - 1;
  const day = Number(d);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Wireframe x-reports — company-wide summary; only an Executive can export
 * the WHOLE company. Real data (B-060 addendum to B-054 Phase 2).
 *
 * 2026-08-10: two gaps closed —
 *  1. **Real export.** The "Download" button now writes a genuine UTF-8 CSV
 *     (Excel-compatible) of the on-screen, filtered rows and opens the native
 *     share sheet via `lib/report-export.ts` — no more `showToast` fake.
 *  2. **Custom date range.** The 'Custom' chip now reveals a lightweight
 *     from/to `YYYY-MM-DD` UI whose range feeds `filterMeetingsByTimeframe()` /
 *     `countNewClientsAcquired()` (via `CustomDateRange`), replacing the old
 *     "no date range picker yet (all-time)" placeholder.
 *
 * The Team chip now also actually scopes every stat (previously it set state
 * but never filtered) — a meeting belongs to a team via its agent's
 * `managerId`, a client via its own `managerId`.
 */
export default function ExecutiveReportsScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useExecutiveOverview();
  const [timeframe, setTimeframe] = useState<ReportTimeframe>(TIMEFRAMES[0]);
  const [teamFilter, setTeamFilter] = useState<'all' | string>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [busy, setBusy] = useState(false);

  const customStart = useMemo(() => parseYmd(customFrom), [customFrom]);
  const customEnd = useMemo(() => parseYmd(customTo), [customTo]);

  // A typed-but-unparseable side, or from > to, is surfaced as a hint and NOT
  // applied (that side falls back to open-ended) so stats never silently lie.
  const customFromInvalid = customFrom.trim().length > 0 && !customStart;
  const customToInvalid = customTo.trim().length > 0 && !customEnd;
  const rangeReversed = !!customStart && !!customEnd && customStart.getTime() > customEnd.getTime();

  // Memoized so the stat `useMemo`s below keep a stable dependency (a fresh
  // object every render would defeat their memoization).
  const customRange: CustomDateRange | undefined = useMemo(
    () =>
      timeframe === 'Custom'
        ? { start: customStart, end: rangeReversed ? null : customEnd }
        : undefined,
    [timeframe, customStart, customEnd, rangeReversed]
  );

  // Agent → managerId map, so the Team chip can scope meetings (which only
  // carry an agentId) up to their owning manager.
  const managerIdByAgentId = useMemo(
    () => new Map((overview?.agents ?? []).map((a) => [a.id, a.managerId])),
    [overview]
  );

  const filteredMeetings = useMemo(() => {
    if (!overview) return [];
    return filterMeetingsByTimeframe(overview.meetings, timeframe, new Date(), customRange).filter(
      (m) => teamFilter === 'all' || managerIdByAgentId.get(m.agentId) === teamFilter
    );
  }, [overview, timeframe, customRange, teamFilter, managerIdByAgentId]);

  const successful = filteredMeetings.filter((m) => m.outcome === 'success').length;
  const lost = filteredMeetings.filter((m) => m.outcome === 'lost').length;

  const newClientsAcquired = useMemo(() => {
    if (!overview) return 0;
    const scoped =
      teamFilter === 'all'
        ? overview.clients
        : overview.clients.filter((c) => c.managerId === teamFilter);
    return countNewClientsAcquired(scoped, timeframe, new Date(), customRange);
  }, [overview, timeframe, customRange, teamFilter]);

  const timeframeLabel = useMemo(() => {
    if (timeframe !== 'Custom') return timeframe;
    if (customStart && customEnd && !rangeReversed) return `${formatDayLabel(customStart)} – ${formatDayLabel(customEnd)}`;
    if (customStart && !customEnd) return `From ${formatDayLabel(customStart)}`;
    if (!customStart && customEnd) return `Until ${formatDayLabel(customEnd)}`;
    return 'All-time';
  }, [timeframe, customStart, customEnd, rangeReversed]);

  const scopeLabel = useMemo(() => {
    if (teamFilter === 'all') return 'Whole company';
    const manager = overview?.managers.find((m) => m.id === teamFilter);
    return manager ? `${manager.name}'s team` : 'Whole company';
  }, [teamFilter, overview]);

  /** Assembles the CSV payload from the currently-filtered rows, or `null` when data isn't loaded. Shared by both Save and Share. */
  function buildExportArgs(): { input: ReportExportInput; fileBaseName: string } | null {
    if (!overview) return null;
    const agentById = new Map(overview.agents.map((a) => [a.id, a]));
    const managerNameById = new Map(overview.managers.map((m) => [m.id, m.name]));
    const rows: ReportExportRow[] = filteredMeetings.map((m) => {
      const agent = agentById.get(m.agentId);
      const managerName = agent?.managerId ? managerNameById.get(agent.managerId) ?? '—' : '—';
      return {
        companyName: m.companyName,
        agentName: agent?.name ?? '—',
        managerName,
        date: m.date,
        location: m.location,
        outcome: m.outcome ?? '—',
      };
    });
    return {
      input: {
        scopeLabel,
        timeframeLabel,
        summary: {
          totalMeetings: filteredMeetings.length,
          successful,
          newClientsAcquired,
          lostOpportunities: lost,
        },
        rows,
      },
      fileBaseName: `company-report-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  async function handleSave() {
    const args = buildExportArgs();
    if (!args || busy) return;
    setBusy(true);
    try {
      const result = await saveReportCsv(args.input, args.fileBaseName);
      if (result.status === 'saved') {
        showToast(`CSV saved to “${result.folderName}”`);
      } else if (result.status === 'unsupported') {
        // iOS has no shared Downloads folder — fall back to the share sheet.
        await exportReportCsv(args.input, args.fileBaseName);
      }
      // 'cancelled' (user dismissed the folder picker) → silent no-op.
    } catch (err) {
      console.error('[executive-reports] save failed:', err instanceof Error ? err.message : String(err));
      showToast('Couldn’t save the report. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    const args = buildExportArgs();
    if (!args || busy) return;
    setBusy(true);
    try {
      await exportReportCsv(args.input, args.fileBaseName);
    } catch (err) {
      console.error('[executive-reports] share failed:', err instanceof Error ? err.message : String(err));
      showToast('Couldn’t share the report. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Reports" fallbackHref="/(executive)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginBottom="$2">Timeframe</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom={timeframe === 'Custom' ? '$2.5' : '$3.5'}>
          {TIMEFRAMES.map((t) => (
            <BizChip key={t} label={t} selected={timeframe === t} onPress={() => setTimeframe(t)} />
          ))}
        </XStack>
        {timeframe === 'Custom' ? (
          <YStack gap="$2" marginBottom="$3.5">
            <XStack gap="$2.5">
              <YStack flex={1} gap="$1">
                <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>From</Text>
                <TextInput
                  value={customFrom}
                  onChangeText={setCustomFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={BIZLINK_COLORS.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  style={{
                    backgroundColor: BIZLINK_COLORS.card,
                    borderRadius: 14,
                    height: 46,
                    paddingHorizontal: 14,
                    fontFamily: BIZLINK_FONTS.medium,
                    fontSize: 14,
                    color: BIZLINK_COLORS.text,
                    borderWidth: 1,
                    borderColor: customFromInvalid ? BIZLINK_COLORS.red : BIZLINK_COLORS.line,
                  }}
                />
              </YStack>
              <YStack flex={1} gap="$1">
                <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>To</Text>
                <TextInput
                  value={customTo}
                  onChangeText={setCustomTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={BIZLINK_COLORS.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  style={{
                    backgroundColor: BIZLINK_COLORS.card,
                    borderRadius: 14,
                    height: 46,
                    paddingHorizontal: 14,
                    fontFamily: BIZLINK_FONTS.medium,
                    fontSize: 14,
                    color: BIZLINK_COLORS.text,
                    borderWidth: 1,
                    borderColor: customToInvalid ? BIZLINK_COLORS.red : BIZLINK_COLORS.line,
                  }}
                />
              </YStack>
            </XStack>
            {customFromInvalid || customToInvalid ? (
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red}>
                Use the format YYYY-MM-DD (e.g. 2026-08-01).
              </Text>
            ) : rangeReversed ? (
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red}>
                &ldquo;From&rdquo; must be earlier than &ldquo;To&rdquo;.
              </Text>
            ) : (
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                Leave one side blank for an open-ended range. Both empty = all-time.
              </Text>
            )}
          </YStack>
        ) : null}

        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginBottom="$2">Team</Text>
        <XStack gap="$2" flexWrap="wrap" marginBottom="$4">
          <BizChip label="Whole company" selected={teamFilter === 'all'} onPress={() => setTeamFilter('all')} />
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
            <BizButton small label="Retry" variant="white" onPress={reload} />
          </YStack>
        ) : (
          <BizCard>
            <StatListRow label="Total meetings" value={filteredMeetings.length} />
            <StatListRow label="Successful" value={successful} color={BIZLINK_COLORS.brand} />
            <StatListRow label="New clients acquired" value={newClientsAcquired} color={BIZLINK_COLORS.navy} />
            <StatListRow label="Lost opportunities (meetings)" value={lost} color={BIZLINK_COLORS.red} last />
          </BizCard>
        )}

        <YStack marginTop="$4" gap="$2.5">
          <BizButton
            label={busy ? '  Processing…' : 'Save to device (CSV)'}
            variant="brand"
            icon={<Download size={15} color={BIZLINK_COLORS.card} strokeWidth={1.75} />}
            onPress={handleSave}
            disabled={busy || loading || !!error || !overview}
          />
          <BizButton
            label="Share…"
            variant="white"
            icon={<Share2 size={15} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            onPress={handleShare}
            disabled={busy || loading || !!error || !overview}
          />
        </YStack>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$2.5" lineHeight={18}>
          Only an Executive can export the whole company’s report. The first time you Save, you’ll pick a folder (e.g. Downloads) — it’s remembered next time. Or use Share to email it or save to Drive. The CSV opens in Excel / Google Sheets.
        </Text>
      </ScrollView>
    </YStack>
  );
}
