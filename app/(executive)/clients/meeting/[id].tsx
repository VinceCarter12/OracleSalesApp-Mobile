import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { execAgentById, execClientById, execMeetingById } from '../../../../lib/executive-data';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { Avatar } from '../../../../components/ui/Avatar';
import { execOutcomeBadge } from '../../../../components/executive/exec-badges';

/** Wireframe x-meetingdetail — view-only: outcome, auto-captured proof, agenda, remarks. Never gated (matches the wireframe, which has no lockbtn here). */
export default function ExecutiveMeetingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const meeting = execMeetingById(id);
  if (!meeting) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Meeting not found.</Text>
      </YStack>
    );
  }

  const client = execClientById(meeting.clientId);
  const agent = execAgentById(meeting.agentId);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Meeting Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flexDirection="row" alignItems="center" gap="$3">
          <Avatar initials={agent?.initials ?? '—'} background={agent?.avatar.background ?? BIZLINK_COLORS.soft} color={agent?.avatar.color ?? BIZLINK_COLORS.muted} />
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text}>{client?.name ?? '—'}</Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Agent: {agent?.name ?? '—'}</Text>
          </YStack>
        </BizCard>

        <BizSectionHeader title="Outcome" />
        <XStack gap="$1.5" flexWrap="wrap">
          {execOutcomeBadge(meeting.outcome)}
          {meeting.synced ? (
            <StatusBadge label="Synced" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.brand} />
          ) : (
            <StatusBadge label="Pending sync" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
          )}
        </XStack>

        <BizSectionHeader title="Auto-captured" />
        <BizCard flat gap="$2">
          <XStack alignItems="center" gap="$2">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>✓</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>GPS</Text>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{meeting.gps}</Text>
          </XStack>
          <XStack alignItems="center" gap="$2">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>✓</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Date &amp; time</Text>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{meeting.date} · {meeting.time}</Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5">
            <View width={44} height={44} borderRadius={14} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.card}>
              <Camera size={17} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            </View>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Selfie captured</Text>
          </XStack>
        </BizCard>

        <BizSectionHeader title="Agenda" />
        <XStack gap="$1.5" flexWrap="wrap">
          {meeting.agenda.map((item) => (
            <StatusBadge key={item} label={item} background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.brand} />
          ))}
        </XStack>

        <BizSectionHeader title="Remarks" />
        <BizCard flat>
          <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} lineHeight={20}>{meeting.remarks}</Text>
        </BizCard>
      </ScrollView>
    </YStack>
  );
}
