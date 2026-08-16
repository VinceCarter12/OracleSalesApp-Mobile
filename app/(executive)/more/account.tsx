import { Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text, View, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { useProfileAvatar } from '../../../lib/use-profile-avatar';
import { Avatar } from '../../../components/ui/Avatar';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { LockToggleRow } from '../../../components/security/LockToggleRow';
import { clearSnapshot } from '../../../lib/app-lock/session-snapshot';
import { useSignOutWithSyncWarning } from '../../../lib/use-sign-out-with-sync-warning';
import { SignOutSyncWarningDialog } from '../../../components/bizlink/SignOutSyncWarningDialog';

// NOTE (T-014 Phase 4, ADR-024): bypasses the shared `components/account/AccountScreen.tsx`
// shell — same precedent as Sales (Phase 2) and Manager (Phase 3), both of which
// already stopped using it. Builds its own BizLink-styled layout locally.

/** Wireframe x-account — Executive profile, security row, sign out. Avatar is read-only (admin/web-managed, F-014 follow-up 2026-08-09). */
export default function ExecutiveAccountScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, profileId, role, teamId } = useSession();
  const { session, signOut: signOutSupabase } = useAuth();
  const { avatarUri } = useProfileAvatar(session?.user.id);

  async function completeSignOut(): Promise<void> {
    await signOutSupabase();
    // Batch 5 Slice 1 (ADR-051): must clear on every sign-out path —
    // otherwise the next cold start silently rehydrates this user back in.
    await clearSnapshot();
    signOut();
    router.replace('/(auth)/login');
  }

  const { requestSignOut, dialogProps } = useSignOutWithSyncWarning();

  function handleSignOut(): void {
    void requestSignOut({ profileId, teamId, role, completeSignOut });
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Account & Security" fallbackHref="/(executive)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flexDirection="row" alignItems="center" gap="$3.5">
          {avatarUri ? (
            <View width={60} height={60} borderRadius={30} overflow="hidden">
              <Image source={{ uri: avatarUri }} style={{ width: 60, height: 60 }} resizeMode="cover" />
            </View>
          ) : (
            <Avatar initials="EX" size="lg" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
          )}
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>Executive</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Company-wide access</Text>
          </YStack>
        </BizCard>

        <BizSectionHeader title="Security" />
        <BizCard padding={0}>
          {/* Batch 5 Slice 3/4 (ADR-051): per-user app-root-lock toggle —
              the only Security control on this screen. Native OS
              device-credential unlock fully replaces the old passcode row
              (Slice 4 cleanup); Executive's wireframe now shows this same
              "Fingerprint unlock" row (Wireframe-Executive-BizLink.html). */}
          <LockToggleRow />
        </BizCard>

        <YStack marginTop="$5">
          <BizButton label="Sign Out" variant="red" onPress={handleSignOut} />
        </YStack>
      </ScrollView>
      <SignOutSyncWarningDialog {...dialogProps} />
    </YStack>
  );
}
