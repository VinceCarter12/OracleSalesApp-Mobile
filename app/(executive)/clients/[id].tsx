import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Eye } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../lib/client-status';
import { useExecutiveOverview } from '../../../lib/use-executive-overview';
import { computeExecClientProgress } from '../../../lib/executive-overview-service';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizLockButton } from '../../../components/bizlink/BizLockButton';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { execOutcomeBadge } from '../../../components/executive/exec-badges';
import type { ExecClientChecklist } from '../../../types';

const CHECKLIST_ITEMS: Array<[keyof ExecClientChecklist, string]> = [
  ['name', 'Company name'],
  ['contact', 'Contact person + position'],
  ['number', 'Contact number'],
  ['address', 'Office address'],
  ['channel', 'Sales channel'],
];

/** Wireframe x-detail — gated (ADR-007), view-only client detail: progress % (B-001), checklist, meeting history. B-054 Phase 2: real data. */
export default function ExecutiveClientDetailScreen() {
  const insets = useSafeAreaInsets();
  const { unlocked } = useGate();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { overview, loading, error, reload } = useExecutiveOverview();

  if (!unlocked) return <SecurityGate />;

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas} gap="$3" paddingHorizontal="$5">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
        <BizButton small label="Ulitin" variant="white" onPress={reload} />
      </YStack>
    );
  }

  const client = overview?.clients.find((c) => c.id === id);
  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Client not found.</Text>
      </YStack>
    );
  }

  const agent = overview?.agents.find((a) => a.id === client.agentId);
  const manager = client.managerId ? overview?.managers.find((m) => m.id === client.managerId) : undefined;
  const meetings = overview?.meetings.filter((m) => m.clientId === client.id) ?? [];
  const progress = computeExecClientProgress(client, meetings);
  const badge = CLIENT_STATUS_BADGES[client.status];

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Client" right={<BizLockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flexDirection="row" alignItems="center" gap="$3.5">
          <View
            width={70}
            height={70}
            borderRadius={35}
            borderWidth={7}
            borderColor={progress === 100 ? BIZLINK_COLORS.brand : BIZLINK_COLORS.line}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text}>{progress}%</Text>
          </View>
          <YStack flex={1} gap="$1.5">
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text} lineHeight={20}>{client.name}</Text>
            <XStack gap="$1.5" flexWrap="wrap">
              <StatusBadge {...badge} />
              <StatusBadge label={client.channel} background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.muted} />
            </XStack>
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Manager: <Text color={BIZLINK_COLORS.text} fontFamily={BIZLINK_FONTS.semibold}>{manager?.name ?? '—'}</Text> · Agent:{' '}
              <Text color={BIZLINK_COLORS.text} fontFamily={BIZLINK_FONTS.semibold}>{agent?.name ?? '—'}</Text>
            </Text>
          </YStack>
        </BizCard>

        <BizSectionHeader title="Info completion" />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-8} marginBottom={10} lineHeight={17}>
          Para lang ito sa 1-month data-quality rule — hiwalay na sa progress % sa taas (B-001).
        </Text>
        <BizCard>
          {CHECKLIST_ITEMS.map(([key, label]) => {
            const done = client.checklist[key];
            return (
              <XStack key={key} alignItems="center" gap="$2.5" paddingVertical={7}>
                <View
                  width={22}
                  height={22}
                  borderRadius={11}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={done ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft}
                >
                  <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={done ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted}>
                    {done ? '✓' : '○'}
                  </Text>
                </View>
                <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={done ? BIZLINK_COLORS.text : BIZLINK_COLORS.muted}>{label}</Text>
              </XStack>
            );
          })}
        </BizCard>

        <BizSectionHeader title="Meeting history" />
        {meetings.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} paddingVertical="$3">Wala pang meeting.</Text>
        ) : null}
        {meetings.map((meeting) => (
          <XStack
            key={meeting.id}
            alignItems="center"
            gap="$3"
            backgroundColor={BIZLINK_COLORS.card}
            borderRadius={20}
            padding={14}
            marginBottom={10}
            onPress={() => router.push(`/(executive)/clients/meeting/${meeting.id}`)}
          >
            <YStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.soft}>
              <Calendar size={15} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            </YStack>
            <YStack flex={1} gap="$0.5">
              <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{meeting.date} · {meeting.time}</Text>
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{meeting.location}</Text>
            </YStack>
            {execOutcomeBadge(meeting.outcome)}
            <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
          </XStack>
        ))}

        <XStack alignItems="center" justifyContent="center" gap="$1.5" paddingVertical="$3.5">
          <Eye size={13} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            View-only — ang pag-edit/approve ay nasa manager pa rin.
          </Text>
        </XStack>
      </ScrollView>
    </YStack>
  );
}
