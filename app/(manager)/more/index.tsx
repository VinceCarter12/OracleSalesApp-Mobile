import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart3, Bell, Building2, History, Info, Map, User, Users } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { managerProfile } from '../../../lib/manager-data';
import { BizMoreTile } from '../../../components/bizlink/BizMoreTile';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/** Wireframe s-more — hub for occasional-use features. (Client info protection gate removed for Manager, 2026-07-17 — see ADR-007 follow-up.) */
export default function ManagerMoreScreen() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={21} color={BIZLINK_COLORS.text}>More</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3.5" lineHeight={19}>
          Mga karagdagang feature.
        </Text>
        <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} marginBottom="$3.5" gap="$1">
          <XStack alignItems="center" gap="$1.5">
            <Info size={13} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
              Naka-scope ang app sa sarili mong team (ADR-017)
            </Text>
          </XStack>
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={17}>
            Iisang Sales Manager role lang — walang hiwalay na RSR Manager (tinanggal 2026-07-14, ADR-017). Ang
            track na nakikita mo (Sales o RSR) ay depende sa {managerProfile().team} mo, hindi sa role.
          </Text>
        </YStack>

        <XStack flexWrap="wrap" gap="$3">
          <BizMoreTile
            icon={<Bell size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Notifications"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Sync alerts, deadline reminders</Text>}
            onPress={() => router.push('/(manager)/more/notifications')}
          />
          <BizMoreTile
            icon={<History size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Sync History"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Ano ang na-sync, kailan</Text>}
            onPress={() => router.push('/(manager)/more/sync-history')}
          />
          <BizMoreTile
            icon={<Building2 size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Clients"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Buong client list + info ng bawat isa</Text>}
            onPress={() => router.push('/(manager)/more/clients')}
          />
          <BizMoreTile
            icon={<History size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Sales History"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Records ng lahat ng meetings ng team</Text>}
            onPress={() => router.push('/(manager)/more/meetings')}
          />
          <BizMoreTile
            icon={<Users size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Tag-Along"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Accept/decline requests + approve meetings</Text>}
            onPress={() => router.push('/(manager)/tag-along')}
          />
          <BizMoreTile
            icon={<BarChart3 size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Reports"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Team performance, i-download bilang Excel</Text>}
            onPress={() => router.push('/(manager)/more/reports')}
          />
          <BizMoreTile
            icon={<Map size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Maps"
            subtitle={<StatusBadge label="Pending confirmation" background={BIZLINK_COLORS.amberSoft} color={BIZLINK_COLORS.orange} />}
            onPress={() => router.push('/(manager)/more/maps')}
          />
          <BizMoreTile
            icon={<User size={19} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
            title="Account & Security"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Profile, passcode, sign out</Text>}
            onPress={() => router.push('/(manager)/more/account')}
          />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
