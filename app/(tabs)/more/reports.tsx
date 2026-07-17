import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useMeetings } from '../../../lib/useMeetings';
import { useClients } from '../../../lib/useClients';
import { CLIENT_STATUS_BADGES, getClientStatus } from '../../../lib/client-status';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizStatCard } from '../../../components/bizlink/BizStatCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { Client, Meeting } from '../../../types';

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
function countMeetingsThisWeekByDay(meetings: Meeting[]): number[] {
  const monday = startOfIsoWeek(new Date());
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return meetings.filter((m) => isSameDay(new Date(m.logged_at), day)).length;
  });
}

function WeeklyMeetingsChart({ meetings }: { meetings: Meeting[] }) {
  const counts = countMeetingsThisWeekByDay(meetings);
  const max = Math.max(1, ...counts);
  return (
    <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18} marginTop={12}>
      <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
        Meetings this week
      </Text>
      <XStack alignItems="flex-end" justifyContent="space-between" gap="$2" height={90} marginTop={14}>
        {counts.map((count, i) => (
          <YStack key={WEEKDAY_LABELS[i]} alignItems="center" gap="$1.5" flex={1}>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{count}</Text>
            <View
              width={20}
              height={Math.max(4, (count / max) * 64)}
              borderRadius={6}
              backgroundColor={i % 2 === 0 ? BIZLINK_COLORS.ink : BIZLINK_COLORS.soft}
            />
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {WEEKDAY_LABELS[i]}
            </Text>
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}

function MyClientRow({ client }: { client: Client }) {
  const badge = CLIENT_STATUS_BADGES[getClientStatus(client)];
  return (
    <Pressable onPress={() => router.push(`/(tabs)/clients/${client.id}`)}>
      <XStack
        alignItems="center"
        gap="$3"
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={16}
        marginBottom={10}
      >
        <YStack flex={1} gap="$0.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.company_name}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {client.contact_person || 'Walang contact person pa'}
          </Text>
        </YStack>
        <StatusBadge {...badge} />
      </XStack>
    </Pressable>
  );
}

/** Wireframe a-reports — My Performance: own stats only (managers see team-wide elsewhere). */
export default function MyPerformanceScreen() {
  const insets = useSafeAreaInsets();
  const { meetings } = useMeetings();
  const { clients } = useClients();

  const now = new Date();
  const thisMonth = meetings.filter((m) => {
    const d = new Date(m.logged_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const successful = thisMonth.filter((m) => m.outcome === 'Successful').length;
  const newClients = clients.filter((c) => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const lost = thisMonth.filter((m) => m.outcome === 'Lost Opportunity').length;
  const rate = thisMonth.length > 0 ? Math.round((successful / thisMonth.length) * 100) : 0;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="My Performance" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <XStack flexWrap="wrap" gap={10}>
          <YStack width="48%">
            <BizStatCard tone="tintA" value={thisMonth.length} label="Meetings" caption="this month" minWidth={0} />
          </YStack>
          <YStack width="48%">
            <BizStatCard tone="white" value={successful} label="Successful" caption={`${rate}% rate`} minWidth={0} />
          </YStack>
          <YStack width="48%">
            <BizStatCard tone="white" value={newClients} label="New clients" caption="acquired" minWidth={0} />
          </YStack>
          <YStack width="48%">
            <BizStatCard tone="tintB" value={lost} label="Lost opportunities" caption="bantayan" minWidth={0} />
          </YStack>
        </XStack>

        <WeeklyMeetingsChart meetings={meetings} />

        <BizSectionHeader title="Mga Client Ko" />
        {clients.slice(0, 5).map((client) => (
          <MyClientRow key={client.id} client={client} />
        ))}
        {clients.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">
            Wala ka pang clients.
          </Text>
        ) : null}

        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$4">
          Sariling performance lang — hindi kasama ang ibang agents (yun ay para sa manager na).
        </Text>
      </ScrollView>
    </YStack>
  );
}
