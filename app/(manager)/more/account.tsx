import { Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ImagePlus, Key, Lock } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { managerProfile } from '../../../lib/manager-data';
import { useManagerDashboard } from '../../../lib/useManagerDashboard';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { useProfileAvatar } from '../../../lib/use-profile-avatar';
import { showToast } from '../../../lib/toast';
import { Avatar } from '../../../components/ui/Avatar';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';

interface SecurityItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress?: () => void;
}

// NOTE (T-014 Phase 3, ADR-024): bypasses the shared `components/account/AccountScreen.tsx`
// shell — same precedent as the Sales Agent account screen (Phase 2) — since that
// shell is also consumed by `app/(executive)/more/account.tsx` (Phase 4, out of
// scope). Builds its own BizLink-styled layout locally instead.
const SECURITY_ITEMS: SecurityItem[] = [
  {
    key: 'passcode',
    icon: <Key size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />,
    label: 'Change passcode',
    onPress: () => showToast('✓ Passcode updated (demo)'),
  },
  {
    key: 'client-info-protection',
    icon: <Lock size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />,
    label: 'Client info protection',
    sublabel: 'Fingerprint / passcode required to view',
  },
];

/** Wireframe s-account (was Profile) — ungated: this-month stats, security row, sign out. */
export default function ManagerAccountScreen() {
  const insets = useSafeAreaInsets();
  const { summary } = useManagerDashboard();
  const { signOut } = useSession();
  const { session, signOut: signOutSupabase } = useAuth();
  const profile = managerProfile();
  const { avatarUri, pickingAvatar, handlePickAvatar } = useProfileAvatar(session?.user.id);

  async function handleSignOut(): Promise<void> {
    await signOutSupabase();
    signOut();
    router.replace('/(auth)/login');
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Account & Security" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flexDirection="row" alignItems="center" gap="$3.5">
          <View position="relative">
            {avatarUri ? (
              <View width={60} height={60} borderRadius={30} overflow="hidden">
                <Image source={{ uri: avatarUri }} style={{ width: 60, height: 60 }} resizeMode="cover" />
              </View>
            ) : (
              <Avatar initials={profile.fullName.split(' ').map((part) => part[0]).join('')} size="lg" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
            )}
            <View
              position="absolute"
              right={-4}
              bottom={-4}
              width={26}
              height={26}
              borderRadius={13}
              backgroundColor={BIZLINK_COLORS.brand}
              borderWidth={2}
              borderColor={BIZLINK_COLORS.card}
              alignItems="center"
              justifyContent="center"
              onPress={pickingAvatar ? undefined : handlePickAvatar}
            >
              <ImagePlus size={13} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
            </View>
          </View>
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>{profile.fullName}</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{profile.title} · {profile.team}</Text>
          </YStack>
        </BizCard>

        <BizSectionHeader title="This month" />
        <XStack gap={10}>
          <StatBox value={summary?.teamMeetings ?? 0} label="Team meetings" />
          <StatBox value={summary?.teamProspects ?? 0} label="Prospects" />
          <StatBox value={7} label="New clients" />
        </XStack>

        <BizSectionHeader title="Security" />
        <BizCard padding={0}>
          {SECURITY_ITEMS.map((item, index) => (
            <XStack
              key={item.key}
              alignItems="center"
              gap="$2.5"
              padding={16}
              minHeight={44}
              borderBottomWidth={index === SECURITY_ITEMS.length - 1 ? 0 : 1}
              borderBottomColor={BIZLINK_COLORS.line}
              onPress={item.onPress}
            >
              {item.icon}
              <YStack flex={1}>
                <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>{item.label}</Text>
                {item.sublabel ? (
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{item.sublabel}</Text>
                ) : null}
              </YStack>
              {item.onPress ? <Text color={BIZLINK_COLORS.muted}>›</Text> : null}
            </XStack>
          ))}
        </BizCard>

        <BizCard flat marginTop="$4">
          <XStack alignItems="center" gap="$2">
            <Lock size={13} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Session policy</Text>
          </XStack>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$1" lineHeight={18}>
            Naka-login ka buong araw kahit offline. Auto-logout tuwing 12:00 midnight. Kapag nawala ang phone, admin
            ang magde-deactivate ng account.
          </Text>
        </BizCard>

        <YStack marginTop="$5">
          <BizButton label="Sign Out" variant="red" onPress={handleSignOut} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function StatBox({ value, label }: { value: number | string; label: string }) {
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14}>
      <Text fontSize={20} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{value}</Text>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{label}</Text>
    </YStack>
  );
}
