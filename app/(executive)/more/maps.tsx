import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Map } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { EXEC_MEETINGS, execAgentById, execClientById } from '../../../lib/executive-data';
import { TopBar } from '../../../components/ui/TopBar';
import { SectionHeader } from '../../../components/ui/SectionHeader';

/**
 * Wireframe x-maps — company-wide meeting-location pins. The wireframe uses a
 * mock map; the real map render (Leaflet sa WebView, same tiles/pins as the
 * web app — Context.md cross-repo MAPS section, OQ-8) is pending, so the pin
 * canvas is a placeholder while the meeting-locations list is real mock data.
 */
export default function ExecutiveMapsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Maps" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3" lineHeight={19}>
          Pinpoint ng lahat ng meeting locations, company-wide — pang-verify na totoong nagpunta ang agent.
        </Text>

        <YStack
          height={190}
          borderRadius={16}
          borderWidth={2}
          borderColor={COLORS.swan}
          backgroundColor={COLORS.polar}
          alignItems="center"
          justifyContent="center"
          gap="$2"
        >
          <Map size={32} color={COLORS.hare} />
          <Text fontSize={12} fontWeight="700" color={COLORS.hare} textAlign="center" paddingHorizontal="$4">
            Map render pending (Leaflet sa WebView, same tiles ng web app — OQ-8)
          </Text>
        </YStack>

        <XStack gap="$3.5" marginTop="$2.5" justifyContent="center">
          <LegendItem color={COLORS.blue} label="Prospect" />
          <LegendItem color={COLORS.feather} label="New" />
          <LegendItem color={COLORS.wolf} label="Existing" />
        </XStack>

        <SectionHeader title="Recent meeting locations" />
        {EXEC_MEETINGS.map((meeting) => {
          const client = execClientById(meeting.clientId);
          const agent = execAgentById(meeting.agentId);
          return (
            <Pressable key={meeting.id} onPress={() => router.push(`/(executive)/clients/meeting/${meeting.id}`)}>
              <XStack alignItems="center" gap="$3" paddingVertical={13} borderBottomWidth={2} borderBottomColor={COLORS.polar}>
                <View width={38} height={38} borderRadius={19} alignItems="center" justifyContent="center" backgroundColor={agent?.avatar.background ?? COLORS.polar}>
                  <Text fontWeight="800" fontSize={13} color={agent?.avatar.color ?? COLORS.wolf}>{agent?.initials ?? '—'}</Text>
                </View>
                <YStack flex={1} gap="$0.5">
                  <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client?.name ?? '—'}</Text>
                  <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
                    {agent?.name ?? '—'} · {meeting.location} · {meeting.date}
                  </Text>
                </YStack>
                <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
              </XStack>
            </Pressable>
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
      <Text fontSize={11.5} fontWeight="700" color={COLORS.wolf}>{label}</Text>
    </XStack>
  );
}
