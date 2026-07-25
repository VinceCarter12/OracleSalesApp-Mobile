import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { History, LogOut, Package, Vault } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';

/**
 * F-007 first draft (2026-07-25): Driver More menu — wireframe `d-more`,
 * trimmed to what exists. History is pending the OQ-5 spec pass; Account &
 * Security will reuse the shared account pattern like the other roles.
 */

function MoreTile({ icon, title, subtitle, onPress }: { icon: React.ReactNode; title: string; subtitle: string; onPress?: () => void }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <Pressable onPress={onPress} style={{ flexBasis: '47%', flexGrow: 1 }}>
      <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={16} gap="$2" opacity={onPress ? 1 : 0.55}>
        <YStack width={42} height={42} borderRadius={14} backgroundColor={BIZLINK_COLORS.tintA} alignItems="center" justifyContent="center">
          {icon}
        </YStack>
        <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{title}</Text>
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={14}>{subtitle}</Text>
      </YStack>
    </Pressable>
  );
}

export default function DeliveryMoreScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$2">
        <Text fontSize={21} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-0.4} color={BIZLINK_COLORS.text}>
          More
        </Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        <XStack gap={12} flexWrap="wrap" marginTop={6}>
          <MoreTile
            icon={<Package size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Purchase Orders"
            subtitle="Assigned POs mo"
            onPress={() => router.push('/(delivery)/pos')}
          />
          <MoreTile
            icon={<Vault size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="Remit COD"
            subtitle="I-remit ang hawak na COD collections"
            onPress={() => router.push('/(delivery)/remit')}
          />
          <MoreTile
            icon={<History size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            title="History"
            subtitle="Pending spec (OQ-5)"
          />
        </XStack>

        <Pressable onPress={signOut} style={{ marginTop: 24 }}>
          <XStack
            backgroundColor={BIZLINK_COLORS.red}
            borderRadius={999}
            height={52}
            alignItems="center"
            justifyContent="center"
            gap="$2"
          >
            <LogOut size={17} color="#FFFFFF" strokeWidth={1.75} />
            <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color="#FFFFFF">Sign Out</Text>
          </XStack>
        </Pressable>
      </ScrollView>
    </YStack>
  );
}
