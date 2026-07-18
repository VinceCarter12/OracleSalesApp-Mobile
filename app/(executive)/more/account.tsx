import { useCallback, useState } from 'react';
import { Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ImagePlus, Key } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { showToast } from '../../../lib/toast';
import { getStoredAvatarUri, pickProfileAvatar } from '../../../lib/profile-avatar';
import { Avatar } from '../../../components/ui/Avatar';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';

// NOTE (T-014 Phase 4, ADR-024): bypasses the shared `components/account/AccountScreen.tsx`
// shell — same precedent as Sales (Phase 2) and Manager (Phase 3), both of which
// already stopped using it. Builds its own BizLink-styled layout locally.

/** Wireframe x-account — Executive profile, security row, sign out. Gallery avatar picker reused from lib/profile-avatar.ts (ADR-007 follow-up, F-014). */
export default function ExecutiveAccountScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();
  const { signOut: signOutSupabase } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getStoredAvatarUri().then(setAvatarUri);
    }, [])
  );

  async function handlePickAvatar(): Promise<void> {
    setPickingAvatar(true);
    try {
      const uri = await pickProfileAvatar();
      if (uri) setAvatarUri(uri);
    } catch {
      showToast('Hindi ma-set ang profile picture. Subukan ulit.');
    } finally {
      setPickingAvatar(false);
    }
  }

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
              <Avatar initials="EX" size="lg" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
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
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>Executive</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Company-wide na access</Text>
          </YStack>
        </BizCard>

        <BizSectionHeader title="Security" />
        <BizCard padding={0}>
          <XStack alignItems="center" gap="$2.5" padding={16} minHeight={44} onPress={() => showToast('✓ Passcode updated (demo)')}>
            <Key size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            <YStack flex={1}>
              <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Change passcode</Text>
            </YStack>
            <Text color={BIZLINK_COLORS.muted}>›</Text>
          </XStack>
        </BizCard>

        <YStack marginTop="$5">
          <BizButton label="Sign Out" variant="red" onPress={handleSignOut} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
