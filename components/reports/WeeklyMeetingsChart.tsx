import { useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { Meeting } from '../../types';

/** Both local Sales meetings and live Manager team meetings carry one of
 * these date fields. Keeping the chart generic avoids a second aggregation
 * implementation for the Manager report. */
type WeeklyChartMeeting = Pick<Meeting, 'logged_at'> | { meetingDateIso?: string };

function meetingDateOf(meeting: WeeklyChartMeeting): Date | null {
  const iso = 'logged_at' in meeting ? meeting.logged_at : meeting.meetingDateIso;
  return iso ? new Date(iso) : null;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** Monday 00:00 of the ISO week containing `date` — kept simple per scope (Mon–Fri only, no timezone edge-case handling). */
function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Client-side aggregation over the agent's own already-loaded meetings — Mon–Fri counts for the current ISO week. */
function countMeetingsThisWeekByDay<T extends WeeklyChartMeeting>(meetings: T[]): number[] {
  const monday = startOfIsoWeek(new Date());
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return meetings.filter((m) => {
      const meetingDate = meetingDateOf(m);
      return meetingDate ? isSameDay(meetingDate, day) : false;
    }).length;
  });
}

/** Exported for the Reports screen's drill-down panel — same week math as the chart above uses to render the curve. */
export function meetingsForWeekday<T extends WeeklyChartMeeting>(meetings: T[], dayIndex: number): T[] {
  const monday = startOfIsoWeek(new Date());
  const day = new Date(monday);
  day.setDate(monday.getDate() + dayIndex);
  return meetings.filter((m) => {
    const meetingDate = meetingDateOf(m);
    return meetingDate ? isSameDay(meetingDate, day) : false;
  });
}

export { WEEKDAY_LABELS };

// Fixed logical coordinate system for the chart (react-native-svg viewBox,
// stretched to the container's real width via preserveAspectRatio="none" —
// see the note on the touch overlay below for why we don't need to measure
// actual pixels to keep taps aligned).
const VB_WIDTH = 300;
const VB_HEIGHT = 132;
const PAD_X = 20;
const PAD_TOP = 36;
const PAD_BOTTOM = 16;
const PLOT_HEIGHT = VB_HEIGHT - PAD_TOP - PAD_BOTTOM;
const BASELINE_Y = PAD_TOP + PLOT_HEIGHT;
const bubbleWidth = 40;
const bubbleHeight = 22;
const BUBBLE_GAP = 8;
const CHART_EDGE_INSET = 4;

interface Point {
  x: number;
  y: number;
}

function pointsFor(counts: number[], max: number): Point[] {
  const step = (VB_WIDTH - PAD_X * 2) / (counts.length - 1);
  return counts.map((count, i) => ({
    x: PAD_X + i * step,
    y: PAD_TOP + PLOT_HEIGHT - (count / max) * PLOT_HEIGHT,
  }));
}

/**
 * Uniform Catmull-Rom-to-Bezier smoothing — the standard way to turn a
 * handful of data points into the gently wavy curve Vince asked to
 * replicate (2026-08-08 reference: a smart-home energy widget's weekly
 * trend graph), rather than the sharp straight-line segments a naive
 * point-to-point path would give.
 */
function smoothLinePath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function smoothAreaPath(points: Point[]): string {
  const line = smoothLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x},${BASELINE_Y} L ${first.x},${BASELINE_Y} Z`;
}

/**
 * Keep the selected value callout close to its point instead of pinning it to
 * the top of the SVG. The preferred position is above the point; when the
 * point is near the top edge, place it below instead. Both positions are
 * clamped against the chart's available logical height so the callout remains
 * visible when the card is rendered at a different device width/height.
 */
export function bubbleYForPoint(pointY: number, chartHeight = VB_HEIGHT): number {
  const top = CHART_EDGE_INSET;
  const bottom = Math.max(top, chartHeight - bubbleHeight - CHART_EDGE_INSET);
  const above = pointY - bubbleHeight - BUBBLE_GAP;
  if (above >= top) return Math.min(above, bottom);

  const below = pointY + BUBBLE_GAP;
  if (below <= bottom) return Math.max(below, top);

  return Math.min(Math.max(above, top), bottom);
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
// NOTE: deliberately NOT Animated.createAnimatedComponent(SvgText) — react-
// native-svg's animated Text reliably fails to paint its glyphs (the pill
// and dot animate fine since those are plain shapes), so the count number
// never showed up inside the bubble. Plain SvgText + a static opacity keyed
// off `selected` sidesteps the bug while keeping the pill/dot pop-in.

/**
 * 2026-08-08 full redesign (Vince, with a smart-home energy widget as the
 * reference): replaces the old mini bar chart with a smooth-curve area
 * chart — gradient fill under a Catmull-Rom-smoothed line, a dashed
 * indicator + dot marking the selected day, and a floating value bubble —
 * kept entirely in the Corporate Emerald green palette (the reference used
 * orange; PRODUCT.md's anti-references also rule out decorative gradients,
 * so the fill here is treated as functional data-viz shading — a single
 * brand-green hue fading to transparent, not a decorative accent) per
 * `.claude/rules/50-wireframe-redesign.md`'s "design-only, preserve real
 * behavior" scope. Tap-to-select is preserved: an invisible 5-column
 * `Pressable` overlay sits on top of the SVG (same as the day labels below
 * it), so this stays a drill-down trigger for the results panel elsewhere
 * on the Reports screen, not just a static illustration.
 */
export function WeeklyMeetingsChart<T extends WeeklyChartMeeting>({
  meetings,
  selectedDay,
  onSelectDay,
  title = 'Meetings this week',
}: {
  meetings: T[];
  selectedDay: number | null;
  onSelectDay: (dayIndex: number) => void;
  /** Manager reports name the same aggregation explicitly as team-wide. */
  title?: string;
}) {
  const BIZLINK_COLORS = useBizlinkColors();
  const counts = countMeetingsThisWeekByDay(meetings);
  const max = Math.max(1, ...counts);
  const points = pointsFor(counts, max);

  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [enter]);

  const [pop] = useState(() => new Animated.Value(0));
  useEffect(() => {
    pop.setValue(0);
    if (selectedDay === null) return;
    Animated.spring(pop, { toValue: 1, useNativeDriver: false, friction: 6, tension: 90 }).start();
  }, [selectedDay, pop]);

  const selected = selectedDay !== null ? points[selectedDay] : null;
  const selectedCount = selectedDay !== null ? counts[selectedDay] : null;
  const bubbleX = selected ? Math.min(Math.max(selected.x - bubbleWidth / 2, PAD_X - 8), VB_WIDTH - PAD_X - bubbleWidth + 8) : 0;
  const bubbleY = selected ? bubbleYForPoint(selected.y) : 0;
  const dotRadius = pop.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });

  return (
    <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18} marginTop={12}>
      <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
        {title}
      </Text>
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={2}>
        {selectedDay !== null && selectedCount !== null
          ? `${WEEKDAY_LABELS[selectedDay]} — meetings this week`
          : 'I-tap ang isang araw para makita ang mga meeting nito'}
      </Text>

      <View style={{ position: 'relative', marginTop: 12 }}>
        <Animated.View
          style={{
            opacity: enter,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <Svg width="100%" height={VB_HEIGHT} viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="weeklyAreaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={BIZLINK_COLORS.brand} stopOpacity={0.22} />
                <Stop offset="1" stopColor={BIZLINK_COLORS.brand} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            <Path d={smoothAreaPath(points)} fill="url(#weeklyAreaFill)" />
            <Path d={smoothLinePath(points)} stroke={BIZLINK_COLORS.brand} strokeWidth={2.75} fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {selected ? (
              <>
                <Path
                  d={`M ${selected.x},${selected.y + 6} L ${selected.x},${BASELINE_Y}`}
                  stroke={BIZLINK_COLORS.ink}
                  strokeWidth={1.5}
                  strokeDasharray="3,4"
                  strokeOpacity={0.45}
                />
                <AnimatedCircle cx={selected.x} cy={selected.y} r={dotRadius} fill={BIZLINK_COLORS.card} stroke={BIZLINK_COLORS.brand} strokeWidth={2.5} />
                <AnimatedRect
                  x={bubbleX}
                  y={bubbleY}
                  width={bubbleWidth}
                  height={bubbleHeight}
                  rx={11}
                  fill={BIZLINK_COLORS.brand}
                  opacity={pop}
                />
                <SvgText
                  x={bubbleX + bubbleWidth / 2}
                  y={bubbleY + bubbleHeight / 2 + 4}
                  fontSize={12}
                  fontWeight="700"
                  fill="#FFFFFF"
                  textAnchor="middle"
                >
                  {selectedCount}
                </SvgText>
              </>
            ) : null}
          </Svg>
        </Animated.View>

        {/* Tap-to-select overlay — 5 equal flex columns approximate the day
            regions closely enough for touch purposes without needing an
            onLayout pixel measurement pass (the visual dot/bubble use exact
            SVG-space coordinates independently via `points` above). */}
        <XStack position="absolute" top={0} left={0} right={0} bottom={0}>
          {WEEKDAY_LABELS.map((label, i) => (
            <Pressable key={label} onPress={() => onSelectDay(i)} style={{ flex: 1 }} hitSlop={4} />
          ))}
        </XStack>
      </View>

      <XStack justifyContent="space-between" marginTop={4}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Pressable key={label} onPress={() => onSelectDay(i)} hitSlop={6} style={{ flex: 1, alignItems: 'center' }}>
            <Text
              fontSize={11}
              fontFamily={selectedDay === i ? BIZLINK_FONTS.semibold : BIZLINK_FONTS.medium}
              color={selectedDay === i ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </XStack>
    </YStack>
  );
}
