import { useState } from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ShieldAlert, LogOut } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session-store';
import { clearSnapshot } from '../../lib/app-lock/session-snapshot';

/**
 * Batch 5 Slice 2 (ADR-051) — full-screen confirmed-suspension state.
 * Rendered by `RootNavigator` (app/_layout.tsx) whenever
 * `useSession().suspended` is true, in place of the normal Stack.Protected
 * tree. Matches the login screen's dark "ink" full-bleed treatment
 * (BizLink), since there is no Design-System-Catalog entry for this state
 * yet (ADR-051 flagged this as a design-system gap, not to be designed
 * ad hoc beyond reusing existing tokens/components).
 *
 * No SQLite wipe here (ADR-051) — sync just halts because `signOut()`
 * clears the session; unsynced field data survives on-device.
 */
export function AccountSuspendedScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      await clearSnapshot();
      signOut();
      router.replace('/(auth)/login');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <YStack
      flex={1}
      backgroundColor={BIZLINK_COLORS.ink}
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$7"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
      gap="$5"
    >
      <View
        width={72}
        height={72}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={BIZLINK_ON_INK.circleFill}
        borderWidth={1}
        borderColor={BIZLINK_ON_INK.circleBorder}
      >
        <ShieldAlert size={32} color={BIZLINK_COLORS.red} strokeWidth={1.75} />
      </View>

      <YStack alignItems="center" gap="$2">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={19} color={BIZLINK_COLORS.card} textAlign="center">
          Account Deactivated
        </Text>
        <Text
          fontSize={13.5}
          fontFamily={BIZLINK_FONTS.medium}
          color={BIZLINK_ON_INK.textMuted}
          textAlign="center"
          lineHeight={19}
        >
          Your account was deactivated by an administrator. Contact your admin if you believe this is a mistake.
        </Text>
      </YStack>

      <Pressable
        onPress={handleSignOut}
        disabled={signingOut}
        style={{
          minHeight: 44,
          height: 52,
          minWidth: 160,
          borderRadius: 999,
          backgroundColor: BIZLINK_COLORS.card,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: signingOut ? 0.6 : 1,
          paddingHorizontal: 24,
        }}
      >
        <XStack gap="$2" alignItems="center">
          {signingOut ? <Spinner color={BIZLINK_COLORS.ink} /> : <LogOut size={16} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
          <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Text>
        </XStack>
      </Pressable>
    </YStack>
  );
}
