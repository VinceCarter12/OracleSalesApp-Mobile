import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart3, Bell, ClipboardCheck, History, Map, RotateCcw, User, Users } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { canClaimLostOpportunity } from '../../../lib/policies/lost-opportunity-claim-policy';
import { BizMoreTile } from '../../../components/bizlink/BizMoreTile';

/** Wireframe a-more — grid of secondary destinations; lock dots mark gated (sensitive) info. */
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { role } = useSession();
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={26} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>More</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3.5">
          Ang sensitibong impormasyon ay nangangailangan ng fingerprint o device lock.
        </Text>
        <XStack flexWrap="wrap" gap="$3" justifyContent="space-between">
          <BizMoreTile
            icon={<Bell size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Notifications"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Sync alerts, deadline reminders</Text>}
            onPress={() => router.push('/(tabs)/more/notifications')}
          />
          <BizMoreTile
            icon={<Users size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Tag-Along"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Hilingin sa manager na sumama</Text>}
            onPress={() => router.push('/(tabs)/more/tag-along')}
          />
          <BizMoreTile
            icon={<History size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Sync History"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Ano ang na-sync, kailan</Text>}
            onPress={() => router.push('/(tabs)/more/sync-history')}
          />
          <BizMoreTile
            icon={<BarChart3 size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="My Performance"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Sariling stats lang</Text>}
            onPress={() => router.push('/(tabs)/more/reports')}
          />
          <BizMoreTile
            icon={<Map size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Maps"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Read-only office pins</Text>}
            onPress={() => router.push('/(tabs)/more/maps')}
          />
          <BizMoreTile
            icon={<ClipboardCheck size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="My Requests"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>PO, edit, at tag-along status</Text>}
            onPress={() => router.push('/(tabs)/more/my-requests')}
          />
          {canClaimLostOpportunity(role) ? (
            <BizMoreTile
              icon={<RotateCcw size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
              title="Lost Opportunities"
              subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Claim released prospects</Text>}
              onPress={() => router.push('/(tabs)/more/lost-opportunities')}
            />
          ) : null}
          <BizMoreTile
            icon={<User size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Account & Security"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Profile, device lock, sign out</Text>}
            onPress={() => router.push('/(tabs)/more/account')}
          />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
