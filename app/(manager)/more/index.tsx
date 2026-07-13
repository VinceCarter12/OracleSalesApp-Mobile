import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { BarChart3, Building2, History, Info, Map, User, Users } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { managerProfile } from '../../../lib/manager-data';
import { MoreTile } from '../../../components/more/MoreTile';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/** Wireframe s-more — hub for sensitive (locked) + occasional-use features. */
export default function ManagerMoreScreen() {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={21} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>More</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3.5" lineHeight={19}>
          Dito nakalagay ang mga sensitibong impormasyon (naka-lock) at ang mga bihirang gamitin na feature.
        </Text>
        <YStack backgroundColor={COLORS.polar} borderRadius={16} padding="$3.5" marginBottom="$3.5" gap="$1">
          <XStack alignItems="center" gap="$1.5">
            <Info size={13} color={COLORS.eel} />
            <Text fontSize={12.5} fontWeight="800" color={COLORS.eel}>
              Naka-scope ang app sa sarili mong team (ADR-014)
            </Text>
          </XStack>
          <Text fontSize={12} fontWeight="600" color={COLORS.hare} lineHeight={17}>
            Magkahiwalay na role ang Sales Manager at RSR Manager — parehong gumagamit ng app na ito, pero ang
            nakikita mo ay ang {managerProfile().team} mo lang, hindi ang kabilang track.
          </Text>
        </YStack>

        <XStack flexWrap="wrap" gap="$3">
          <MoreTile
            icon={<Building2 size={19} color={COLORS.eel} />}
            title="Clients"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Buong client list + info ng bawat isa</Text>}
            locked
            onPress={() => router.push('/(manager)/more/clients')}
          />
          <MoreTile
            icon={<History size={19} color={COLORS.eel} />}
            title="Sales History"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Records ng lahat ng meetings ng team</Text>}
            locked
            onPress={() => router.push('/(manager)/more/meetings')}
          />
          <MoreTile
            icon={<Users size={19} color={COLORS.eel} />}
            title="Tag-Along"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Accept/decline requests + approve meetings</Text>}
            onPress={() => router.push('/(manager)/tag-along')}
          />
          <MoreTile
            icon={<BarChart3 size={19} color={COLORS.eel} />}
            title="Reports"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Team performance, i-download bilang Excel</Text>}
            onPress={() => router.push('/(manager)/more/reports')}
          />
          <MoreTile
            icon={<Map size={19} color={COLORS.eel} />}
            title="Maps"
            subtitle={<StatusBadge label="Pending confirmation" background={COLORS.amberSoft} color={COLORS.orange} />}
            onPress={() => router.push('/(manager)/more/maps')}
          />
          <MoreTile
            icon={<User size={19} color={COLORS.eel} />}
            title="Account & Security"
            subtitle={<Text fontSize={10.5} fontWeight="600" color={COLORS.hare}>Profile, passcode, sign out</Text>}
            onPress={() => router.push('/(manager)/more/account')}
          />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
