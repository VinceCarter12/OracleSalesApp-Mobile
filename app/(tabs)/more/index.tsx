import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart3, Building2, History, Map, User, Users } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { BizMoreTile } from '../../../components/bizlink/BizMoreTile';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/** Wireframe a-more — grid of secondary destinations; lock dots mark gated (sensitive) info. */
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={26} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>More</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3.5">
          Ang sensitibong impormasyon ay nangangailangan ng fingerprint/passcode.
        </Text>
        <XStack flexWrap="wrap" gap="$3" justifyContent="space-between">
          <BizMoreTile
            icon={<Building2 size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Clients"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Buong client list mo</Text>}
            locked
            onPress={() => router.push('/(tabs)/clients')}
          />
          <BizMoreTile
            icon={<History size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="My Meetings"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Records ng lahat ng meetings mo</Text>}
            locked
            onPress={() => router.push('/(tabs)/meetings')}
          />
          <BizMoreTile
            icon={<Users size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Tag-Along"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Hilingin sa manager na sumama</Text>}
            onPress={() => router.push('/(tabs)/more/tag-along')}
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
            subtitle={<StatusBadge label="Pending confirmation" background={BIZLINK_COLORS.tintB} color={BIZLINK_COLORS.red} />}
            onPress={() => router.push('/(tabs)/more/maps')}
          />
          <BizMoreTile
            icon={<User size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Account & Security"
            subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Profile, passcode, sign out</Text>}
            onPress={() => router.push('/(tabs)/more/account')}
          />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
