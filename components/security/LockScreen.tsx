import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fingerprint } from 'lucide-react-native';
import { Spinner, Text, View, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { useAppLock } from '../../lib/app-lock/lock-provider';

/**
 * Batch 5 Slice 3 (ADR-051): replaces `SecurityGate.tsx`'s passcode keypad.
 * Rendered by `LockGate` as an OPAQUE OVERLAY on top of `RootNavigator`
 * (never a tree swap) — `useSync` and any in-progress meeting recording
 * (e.g. `app/(tabs)/meetings/record-visit.tsx`'s GPS/timer/draft state) keep
 * running underneath while this is shown. Matches the login/gate screens'
 * dark "ink" full-bleed treatment (BizLink) — no Design-System-Catalog entry
 * exists yet for this state (ADR-051 flagged this as a design-system gap,
 * not to be designed ad hoc beyond reusing existing tokens/components, same
 * precedent as `AccountSuspendedScreen.tsx`).
 */
export function LockScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { unlock } = useAppLock();
  const [unlocking, setUnlocking] = useState(false);
  const [failed, setFailed] = useState(false);

  async function attemptUnlock(): Promise<void> {
    setUnlocking(true);
    setFailed(false);
    try {
      const success = await unlock();
      if (!success) setFailed(true);
    } finally {
      setUnlocking(false);
    }
  }

  // Auto-prompt once on mount, matching the wireframe gate's on-open
  // fingerprint prompt behavior — the retry button below covers
  // cancellation/failure without re-triggering automatically.
  useEffect(() => {
    void attemptUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount only; re-running on every render would re-prompt continuously.
  }, []);

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
      <Pressable onPress={unlocking ? undefined : attemptUnlock} disabled={unlocking}>
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
          {unlocking ? <Spinner color={BIZLINK_COLORS.card} /> : <Fingerprint size={32} color={BIZLINK_COLORS.card} strokeWidth={1.75} />}
        </View>
      </Pressable>

      <YStack alignItems="center" gap="$2">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={19} color={BIZLINK_COLORS.card} textAlign="center">
          The app is locked
        </Text>
        <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted} textAlign="center" lineHeight={19}>
          Unlock with your fingerprint or device credential to continue.
        </Text>
        {failed ? (
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.red}>
            Couldn't unlock — try again.
          </Text>
        ) : null}
      </YStack>

      <Pressable onPress={unlocking ? undefined : attemptUnlock} disabled={unlocking} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>
          {unlocking ? 'Naghihintay…' : 'Subukan ulit'}
        </Text>
      </Pressable>
    </YStack>
  );
}
