import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_FONTS, useBizlinkColors } from '../../../lib/theme';
import { useManagerDashboard } from '../../../lib/useManagerDashboard';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { useProfileAvatar } from '../../../lib/use-profile-avatar';
import { getManagerOwnNewClientsCount } from '../../../lib/manager-team-service';
import { initialsFromName } from '../../../lib/display-name';
import { Avatar } from '../../../components/ui/Avatar';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { LockToggleRow } from '../../../components/security/LockToggleRow';
import { clearSnapshot } from '../../../lib/app-lock/session-snapshot';
import { useTeamName } from '../../../lib/use-team-name';
import { useSignOutWithSyncWarning } from '../../../lib/use-sign-out-with-sync-warning';
import { SignOutSyncWarningDialog } from '../../../components/bizlink/SignOutSyncWarningDialog';

// NOTE (T-014 Phase 3, ADR-024): bypasses the shared `components/account/AccountScreen.tsx`
// shell — same precedent as the Sales Agent account screen (Phase 2) — since that
// shell is also consumed by `app/(executive)/more/account.tsx` (Phase 4, out of
// scope). Builds its own BizLink-styled layout locally instead.

/** Wireframe s-account (was Profile) — ungated: this-month stats, security row, sign out. */
export default function ManagerAccountScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { summary } = useManagerDashboard();
  const { signOut, fullName, role, teamId, profileId } = useSession();
  const teamName = useTeamName(teamId);
  const { session, signOut: signOutSupabase } = useAuth();
  const { avatarUri } = useProfileAvatar(session?.user.id);
  const [newClientsCount, setNewClientsCount] = useState<number | null>(null);

  const loadNewClientsCount = useCallback(async () => {
    if (!profileId) return;
    try {
      setNewClientsCount(await getManagerOwnNewClientsCount(profileId));
    } catch (err) {
      console.error('[manager-account] new-clients count failed:', err instanceof Error ? err.message : String(err));
    }
  }, [profileId]);

  useEffect(() => {
    loadNewClientsCount();
  }, [loadNewClientsCount]);

  useFocusEffect(useCallback(() => { loadNewClientsCount(); }, [loadNewClientsCount]));

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
      <BizTopBar title="Account & Security" fallbackHref="/(manager)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flexDirection="row" alignItems="center" gap="$3.5">
          {avatarUri ? (
            <View width={60} height={60} borderRadius={30} overflow="hidden">
              <Image source={{ uri: avatarUri }} style={{ width: 60, height: 60 }} resizeMode="cover" />
            </View>
          ) : (
            <Avatar initials={initialsFromName(fullName)} size="lg" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
          )}
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>{fullName ?? '—'}</Text>
            {/* ADR-017: a single `sales_manager` role. Team-level Sales-vs-RSR "track" retired 2026-07-23 — teams are now mixed, team_id no longer implies a track. */}
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Sales Manager · {teamName}</Text>
          </YStack>
        </BizCard>

        <BizSectionHeader title="This month" />
        <XStack gap={10}>
          <StatBox value={summary?.teamMeetings ?? 0} label="Team meetings" />
          <StatBox value={summary?.teamProspects ?? 0} label="Prospects" />
          <StatBox value={newClientsCount ?? 0} label="New clients" />
        </XStack>

        <BizSectionHeader title="Security" />
        <BizCard padding={0}>
          {/* Batch 5 Slice 3/4 (ADR-051): per-user app-root-lock toggle —
              the only Security control on this screen. Native OS
              device-credential unlock fully replaces the old passcode row
              (Slice 4 cleanup); Manager's wireframe now shows this same
              "Fingerprint unlock" row (Wireframe-Manager-BizLink.html). */}
          <LockToggleRow />
        </BizCard>

        <BizCard flat marginTop="$4">
          <XStack alignItems="center" gap="$2">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Staying signed in</Text>
          </XStack>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$1" lineHeight={18}>
            If device-credential unlock is on, your phone's fingerprint, PIN, pattern, or device password is
            used to unlock the app. The app doesn't save a separate passcode.
          </Text>
        </BizCard>

        <YStack marginTop="$5">
          <BizButton label="Sign Out" variant="red" onPress={handleSignOut} />
        </YStack>
      </ScrollView>
      <SignOutSyncWarningDialog {...dialogProps} />
    </YStack>
  );
}

function StatBox({ value, label }: { value: number | string; label: string }) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14}>
      <Text fontSize={20} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>{value}</Text>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{label}</Text>
    </YStack>
  );
}
