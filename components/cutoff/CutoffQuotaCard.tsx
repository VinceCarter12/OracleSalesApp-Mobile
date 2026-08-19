import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { CalendarDays, CircleAlert, Clock, Target } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { getCutoffQuotaCard, type CutoffQuotaCardData } from '../../lib/cutoff-quota-service';
import type { CutoffQuotaRole } from '../../lib/policies/cutoff-policy';
import { subscribeSyncComplete } from '../../lib/sync/sync-events';

interface CutoffQuotaCardProps {
  agentId: string | null;
  role: CutoffQuotaRole;
}

/**
 * W-1 (Wireframe-Sales-BizLink.html `#a-quotaWidget`): shared quota card for
 * every role that carries a target, reusing the RSR widget's visual pattern
 * (ADR-053 contract item 6).
 *
 * The window is a calendar MONTH, not a cutoff, as of web migration 105
 * (2026-08-16) — Sales 35 a month, Manager 20 a month, RSR 16 per working day
 * multiplied out over the month. `periodLabel` therefore reads "August 2026".
 * Managers appear here for the first time in that same change: they used to be
 * measured against their team's number and had no personal one to show.
 *
 * TWO LAYOUTS, chosen by whether the server sent a `dailyTarget` (web migration
 * 109, 2026-08-19), which it does for an RSR and no one else:
 *
 *   Sales / Manager   the month alone, unchanged from 105.
 *   RSR               TODAY first, then the month below it in the SAME shape —
 *                     icon + label, "N / N confirmed", a label line and an 8px
 *                     bar apiece. Priority is carried by order, not by shrinking
 *                     the second one.
 *
 * An RSR's commitment is 16 today; 105's monthly roll-up of it (16 x working
 * days = 336) is the right number for the admin report and unreadable on a
 * phone, since "41 / 336" on the 4th cannot say whether the day is on track.
 * The month stays visible rather than being replaced, because it is what the
 * admin report shows for the same window and the two must never appear to
 * disagree — and it is given equal weight because both numbers genuinely get
 * read, one to work against today and one to be reviewed against.
 *
 * Every bar is two segments (see QuotaBar below): brand for server-confirmed,
 * a lighter tint for locally-recorded-but-unsynced. The second segment is the
 * only part of this card that moves without a connection.
 *
 * On a rest day the daily block STAYS, showing "Rest day" in place of the
 * countdown, rather than the card silently collapsing into the Sales layout on
 * Saturday and back on Monday. Only an explicit `todayIsWorkingDay === false`
 * reads as a rest day — null means a device that has not synced since 109.
 *
 * 2026-08-03 (Vince direction): always renders for a quota role. This
 * component only ever does a plain local SQLite read; the background job that
 * fills `cutoff_role_usage_snapshot` (lib/sync/cutoff-sync-down.ts) is
 * separate and, since 2026-08-04, ungated — the `cutoff_quota_v1` rollout flag
 * no longer guards it (see the call in lib/sync-down.ts). When no row exists
 * yet (sync-down never run, or no target configured for the role), it renders
 * the honest "No quota configured" state — never a hardcoded fallback.
 */
/**
 * A quota bar in two segments: solid brand for what the SERVER has confirmed,
 * and a lighter tint continuing from it for what this phone has recorded but
 * not yet synced.
 *
 * They stay visually distinct rather than summing into one fill because a
 * pending meeting is not guaranteed to be credited — the server still decides
 * attribution and can return `over_cap` or `excluded_invalid` (ADR-053 O-8, the
 * same reason the two counts are never added together in text). A single merged
 * bar would claim credit the agent may not have, and would then visibly retreat
 * after sync. Two segments let the bar respond offline while still being honest
 * about which part is real.
 *
 * The pending segment is clamped to whatever room the confirmed one leaves, so
 * the pair can never exceed the track.
 */
function QuotaBar({
  confirmedPct,
  pendingPct,
  colors,
}: {
  confirmedPct: number;
  pendingPct: number;
  colors: ReturnType<typeof useBizlinkColors>;
}) {
  return (
    <XStack height={8} borderRadius={99} backgroundColor={colors.soft} overflow="hidden">
      {confirmedPct > 0 ? (
        <View height="100%" backgroundColor={colors.brand} width={`${confirmedPct}%`} />
      ) : null}
      {pendingPct > 0 ? (
        <View height="100%" backgroundColor={colors.tintA} width={`${pendingPct}%`} />
      ) : null}
    </XStack>
  );
}

export function CutoffQuotaCard({ agentId, role }: CutoffQuotaCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [data, setData] = useState<CutoffQuotaCardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Same class of bug fixed for Home's own stat cards (app/(tabs)/index.tsx):
  // a plain mount-only useEffect loads whatever the local snapshot holds at
  // that instant, then never checks again. The background cutoff sync-down
  // frequently finishes AFTER Home has already rendered and queried once, so
  // without a focus-triggered refetch the card is stuck showing "No quota
  // configured" for the rest of the session even after real data lands in
  // SQLite. useFocusEffect re-runs every time this screen regains focus
  // (tab switch, returning from another screen, post-login first render).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function load() {
        if (!agentId) {
          await Promise.resolve();
          if (!cancelled) setLoading(false);
          return;
        }
        try {
          const result = await getCutoffQuotaCard(agentId, role);
          if (!cancelled) setData(result);
        } catch (err) {
          console.error('[CutoffQuotaCard] load failed:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      load();
      return () => {
        cancelled = true;
      };
    }, [agentId, role])
  );

  // A post-meeting sync can finish while Home remains focused. Re-read the
  // refreshed SQLite mirror immediately instead of waiting for a tab switch.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeSyncComplete(() => {
      if (!agentId) return;
      getCutoffQuotaCard(agentId, role)
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .catch((err) => console.error('[CutoffQuotaCard] sync refresh failed:', err));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [agentId, role]);

  if (loading) return null;

  const unconfigured = !data || data.target === null;
  const remaining = data && data.target !== null ? Math.max(0, data.target - data.confirmedCount) : 0;
  const pct = data && data.target !== null && data.target > 0 ? Math.min(100, Math.round((data.confirmedCount / data.target) * 100)) : 0;

  // An RSR is the only role the server sends a `dailyTarget` for, so this one
  // non-null check is the whole role decision — the card never re-derives the
  // role list that lib/policies/cutoff-policy.ts and web migration 109 already
  // agree on.
  const daily = data && data.dailyTarget !== null ? data.dailyTarget : null;
  const remainingToday = daily !== null && data ? Math.max(0, daily - data.todayConfirmed) : 0;
  const dailyPct = daily !== null && daily > 0 && data ? Math.min(100, Math.round((data.todayConfirmed / daily) * 100)) : 0;
  // Formatted from the device clock while the counts beside it are the server's
  // Manila "today". Every device in this fleet runs Manila time, so the two
  // agree; a phone deliberately set to another timezone could name yesterday.
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  // Only an explicit false is a rest day. Null means the device has not synced
  // since 109 shipped, and guessing "rest day" there would tell an RSR they are
  // off on a Tuesday.
  const isRestDay = data?.todayIsWorkingDay === false;
  // Locally-counted, so these keep moving with no connection — the one part of
  // the bar that does. Clamped to the space the confirmed segment leaves.
  const pendingPct =
    data && data.target !== null && data.target > 0
      ? Math.max(0, Math.min(100 - pct, Math.round((data.pendingCount / data.target) * 100)))
      : 0;
  // Server daily figures expire at midnight; the month's do not. False here
  // means the snapshot predates today, so the day's bar and count are withheld
  // rather than asserting yesterday's number against today's date.
  const dailyIsCurrent = data?.dailyIsCurrent === true;
  // The day's confirmed fill is withheld when the snapshot predates today, but
  // the pending segment is locally counted for today and stays valid, so it
  // still renders — from zero, since nothing confirmed can be claimed.
  const shownDailyPct = dailyIsCurrent ? dailyPct : 0;
  const dailyPendingPct =
    daily !== null && daily > 0 && data
      ? Math.max(0, Math.min(100 - shownDailyPct, Math.round((data.pendingTodayCount / daily) * 100)))
      : 0;

  return (
    <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18} marginTop={16}>
      {unconfigured ? (
        <YStack gap="$1.5">
          <XStack alignItems="center" gap="$1.5">
            <CircleAlert size={14} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>No quota configured</Text>
          </XStack>
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            There's no active monthly target loaded for your role yet. The app won't use a fallback number.
          </Text>
        </YStack>
      ) : daily !== null ? (
        /* RSR: the DAY leads and the month sits underneath as the reconciling
           number — see the doc block above for why. */
        <YStack gap="$1.5">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$1.5">
              <Target size={14} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Today&apos;s quota</Text>
            </XStack>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
              {dailyIsCurrent ? data.todayConfirmed : '—'} / {daily} confirmed
            </Text>
          </XStack>
          <XStack alignItems="center" justifyContent="space-between">
            {/* An em dash and "Not synced today" rather than a number, when the
                snapshot's daily figures predate today. See `dailyIsCurrent` in
                lib/cutoff-quota-service.ts: printing yesterday's count next to
                today's date is the one genuinely wrong thing this card could do
                offline. The month below stays populated, and the pending chip
                keeps counting locally. */}
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {todayLabel} · {!dailyIsCurrent ? 'Not synced today' : isRestDay ? 'Rest day' : `${remainingToday} to go`}
            </Text>
            {/* Today's pending, not the month's, so it belongs on today's row —
                the chip has to mean the same window as the bar beneath it. */}
            <XStack alignItems="center" gap="$1" backgroundColor={BIZLINK_COLORS.tintA} borderRadius={999} paddingHorizontal={10} paddingVertical={4}>
              <Clock size={11} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
              <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>{data.pendingTodayCount} pending</Text>
            </XStack>
          </XStack>
          <QuotaBar confirmedPct={shownDailyPct} pendingPct={dailyPendingPct} colors={BIZLINK_COLORS} />
          {/* The month is given the SAME treatment as the day above it — header
              row with an icon, "N / N confirmed" on the right, its own label
              line, and a bar of the same 8px weight. The two windows are both
              real and both get read; ordering carries the priority, so the day
              stays first and the month follows it rather than being demoted to a
              caption. The month is kept visible deliberately: it is what the
              admin report shows for the same window, so an RSR always sees the
              number they will be reviewed against next to today's.

              A calendar icon rather than a second target, so the two headers are
              distinguishable at a glance while staying the same shape. */}
          <XStack justifyContent="space-between" alignItems="center" marginTop="$2.5">
            <XStack alignItems="center" gap="$1.5">
              <CalendarDays size={14} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>This month</Text>
            </XStack>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
              {data.confirmedCount} / {data.target} confirmed
            </Text>
          </XStack>
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {data.periodLabel}
          </Text>
          <QuotaBar confirmedPct={pct} pendingPct={pendingPct} colors={BIZLINK_COLORS} />
        </YStack>
      ) : (
        <YStack gap="$1.5">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$1.5">
              <Target size={14} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Monthly quota</Text>
            </XStack>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
              {data.confirmedCount} / {data.target} confirmed
            </Text>
          </XStack>
          {/* The window is the MONTH as of web migration 105, so periodLabel
              now reads "August 2026" — calling it a cutoff here would have
              named it after a fortnight it no longer covers. */}
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {data.periodLabel}
          </Text>
          <QuotaBar confirmedPct={pct} pendingPct={pendingPct} colors={BIZLINK_COLORS} />
          <XStack alignItems="center" justifyContent="space-between" marginTop="$1">
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {remaining} remaining to target
            </Text>
            <XStack alignItems="center" gap="$1" backgroundColor={BIZLINK_COLORS.tintA} borderRadius={999} paddingHorizontal={10} paddingVertical={4}>
              <Clock size={11} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
              <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>{data.pendingCount} pending</Text>
            </XStack>
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
