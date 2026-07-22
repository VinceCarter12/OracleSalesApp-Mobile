import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Map } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useExecutiveOverview } from '../../../lib/use-executive-overview';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { Avatar } from '../../../components/ui/Avatar';

/**
 * Wireframe x-maps — company-wide meeting-location pins. Real data for the
 * LIST portion only (B-060 addendum, 2026-07-23), via
 * lib/executive-overview-service.ts (`ExecMeeting.location`/`.gps`/`.date`
 * already resolved by lib/team-remote-mappers.ts's shared
 * `resolveLocation()`/`formatGps()`/`formatShortDate()` helpers — reused,
 * not reinvented). The map render itself (Leaflet sa WebView, same
 * tiles/pins as the web app — Context.md cross-repo MAPS section, OQ-8)
 * remains explicitly out of scope; the pin canvas below stays a placeholder.
 */
export default function ExecutiveMapsScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useExecutiveOverview();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Maps" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Pinpoint ng lahat ng meeting locations, company-wide — pang-verify na totoong nagpunta ang agent.
        </Text>

        <YStack
          height={190}
          borderRadius={24}
          backgroundColor={BIZLINK_COLORS.card}
          alignItems="center"
          justifyContent="center"
          gap="$2"
        >
          <Map size={32} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingHorizontal="$4">
            Map render pending (Leaflet sa WebView, same tiles ng web app — OQ-8)
          </Text>
        </YStack>

        <XStack gap="$3.5" marginTop="$2.5" justifyContent="center">
          <LegendItem color={BIZLINK_COLORS.navy} label="Prospect" />
          <LegendItem color={BIZLINK_COLORS.brand} label="New" />
          <LegendItem color={BIZLINK_COLORS.muted} label="Existing" />
        </XStack>

        <BizSectionHeader title="Recent meeting locations" />
        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
            <BizButton small label="Ulitin" variant="white" onPress={reload} />
          </YStack>
        ) : !overview || overview.meetings.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Walang naitalang meeting location.
            </Text>
          </YStack>
        ) : (
          overview.meetings.map((meeting) => {
            const agent = overview.agents.find((a) => a.id === meeting.agentId);
            return (
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
                <Avatar initials={agent?.initials ?? '—'} size="sm" background={agent?.avatar.background ?? BIZLINK_COLORS.soft} color={agent?.avatar.color ?? BIZLINK_COLORS.muted} />
                <YStack flex={1} gap="$0.5">
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{meeting.companyName}</Text>
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                    {agent?.name ?? '—'} · {meeting.location} · {meeting.date}
                  </Text>
                </YStack>
                <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
              </XStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <XStack alignItems="center" gap="$1.5">
      <View width={10} height={10} borderRadius={5} backgroundColor={color} />
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{label}</Text>
    </XStack>
  );
}
