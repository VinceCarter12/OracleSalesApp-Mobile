import { Alert, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { useProfileAvatar } from '../../../lib/use-profile-avatar';
import { initialsFromName } from '../../../lib/display-name';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { useThemePreference, type ThemePreference } from '../../../lib/theme-preference';
import { Avatar } from '../../../components/ui/Avatar';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizChip } from '../../../components/bizlink/BizChip';
import { BizButton } from '../../../components/bizlink/BizButton';
import { LockToggleRow } from '../../../components/security/LockToggleRow';
import { clearSnapshot } from '../../../lib/app-lock/session-snapshot';

const APPEARANCE_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// NOTE: this screen bypasses the shared `components/account/AccountScreen.tsx`
// shell (also used by Manager/Executive, out of scope for this Phase 2 pass)
// and builds its own BizLink-styled layout locally, so Manager/Executive's
// account screens are unaffected until their own phases.

/** Wireframe a-account — profile, security actions, session policy, sign out. */
export default function AgentAccountScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, fullName, role } = useSession();
  const { session, signOut: signOutSupabase } = useAuth();
  const { avatarUri, pickingAvatar, handlePickAvatar } = useProfileAvatar(session?.user.id);
  const BIZLINK_COLORS = useBizlinkColors();
  const { preference, setPreference } = useThemePreference();

  function confirmSignOut(): void {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOutSupabase();
          // Batch 5 Slice 1 (ADR-051): the cold-start snapshot MUST be
          // cleared on every sign-out path — otherwise the next cold start
          // silently rehydrates the signed-out user back in.
          await clearSnapshot();
          signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Account & Security" fallbackHref="/(tabs)/more" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flexDirection="row" alignItems="center" gap="$3.5">
          <View position="relative">
            {avatarUri ? (
              <View width={60} height={60} borderRadius={30} overflow="hidden">
                <Image source={{ uri: avatarUri }} style={{ width: 60, height: 60 }} resizeMode="cover" />
              </View>
            ) : (
              <Avatar initials={initialsFromName(fullName)} size="lg" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
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
              <ImagePlus size={13} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
            </View>
          </View>
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>{fullName ?? '—'}</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {role === 'rsr' ? 'RSR' : 'Sales Specialist'}
            </Text>
          </YStack>
        </BizCard>

        <BizSectionHeader title="Security" />
        <BizCard padding={0}>
          {/* Batch 5 Slice 3 refinement (ADR-051): per-user app-root-lock
              toggle, matching Wireframe-Sales-BizLink.html's "Fingerprint
              unlock … On" row (~line 1002). This is now the only Security
              control on this screen — the old passcode-based "Change
              passcode" row was removed in Batch 5 Slice 4 (native OS
              device-credential unlock fully replaces passcode, ADR-051). */}
          <LockToggleRow />
        </BizCard>

        <BizSectionHeader title="Appearance" />
        <XStack gap="$2" flexWrap="wrap">
          {APPEARANCE_OPTIONS.map((opt) => (
            <BizChip
              key={opt.value}
              label={opt.label}
              selected={preference === opt.value}
              onPress={() => setPreference(opt.value)}
            />
          ))}
        </XStack>

        <BizCard flat marginTop="$4">
          <XStack alignItems="center" gap="$2">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Session policy</Text>
          </XStack>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$1" lineHeight={18}>
            Naka-login ka buong araw kahit offline. Auto-logout tuwing 12:00 midnight.
          </Text>
        </BizCard>

        <YStack marginTop="$5">
          <BizButton label="Sign Out" variant="red" onPress={confirmSignOut} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
