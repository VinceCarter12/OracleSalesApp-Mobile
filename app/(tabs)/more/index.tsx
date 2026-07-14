import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart3, Building2, History, Map, User, Users } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { MoreTile } from '../../../components/more/MoreTile';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/** Wireframe a-more — grid of secondary destinations; lock dots mark gated (sensitive) info. */
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>More</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3.5">
          Ang sensitibong impormasyon (🔒) ay nangangailangan ng fingerprint/passcode.
        </Text>
        <XStack flexWrap="wrap" gap="$3" justifyContent="space-between">
          <MoreTile
            icon={<Building2 size={18} color={COLORS.eel} />}
            title="Clients"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Buong client list mo</Text>}
            locked
            onPress={() => router.push('/(tabs)/clients')}
          />
          <MoreTile
            icon={<History size={18} color={COLORS.eel} />}
            title="My Meetings"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Records ng lahat ng meetings mo</Text>}
            locked
            onPress={() => router.push('/(tabs)/meetings')}
          />
          <MoreTile
            icon={<Users size={18} color={COLORS.eel} />}
            title="Tag-Along"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Hilingin sa manager na sumama</Text>}
            onPress={() => router.push('/(tabs)/more/tag-along')}
          />
          <MoreTile
            icon={<BarChart3 size={18} color={COLORS.eel} />}
            title="My Performance"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Sariling stats lang</Text>}
            onPress={() => router.push('/(tabs)/more/reports')}
          />
          <MoreTile
            icon={<Map size={18} color={COLORS.eel} />}
            title="Maps"
            subtitle={<StatusBadge label="Pending confirmation" background={COLORS.amberSoft} color={COLORS.orange} />}
            onPress={() => router.push('/(tabs)/more/maps')}
          />
          <MoreTile
            icon={<User size={18} color={COLORS.eel} />}
            title="Account & Security"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Profile, passcode, sign out</Text>}
            onPress={() => router.push('/(tabs)/more/account')}
          />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
