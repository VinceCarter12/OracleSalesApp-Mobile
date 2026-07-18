import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Map } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { EXEC_MEETINGS, execAgentById, execClientById } from '../../../lib/executive-data';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { Avatar } from '../../../components/ui/Avatar';

/**
 * Wireframe x-maps — company-wide meeting-location pins. The wireframe uses a
 * mock map; the real map render (Leaflet sa WebView, same tiles/pins as the
 * web app — Context.md cross-repo MAPS section, OQ-8) is pending, so the pin
 * canvas is a placeholder while the meeting-locations list is real mock data.
 */
export default function ExecutiveMapsScreen() {
  const insets = useSafeAreaInsets();
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
        {EXEC_MEETINGS.map((meeting) => {
          const client = execClientById(meeting.clientId);
          const agent = execAgentById(meeting.agentId);
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
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client?.name ?? '—'}</Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  {agent?.name ?? '—'} · {meeting.location} · {meeting.date}
                </Text>
              </YStack>
              <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
            </XStack>
          );
        })}
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
