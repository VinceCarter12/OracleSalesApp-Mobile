import { useCallback, useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { getUnlockCapability, requestDeviceUnlock, type UnlockCapability } from '../../lib/device-unlock';
import { useAppLock } from '../../lib/app-lock/lock-provider';
import { getLockPreference, setLockPreference } from '../../lib/app-lock/lock-preference';

const NO_CREDENTIAL_ADVISORY = 'Set a screen lock on this phone to enable this feature';
const CONFIRM_ON_MESSAGE = 'Confirm to turn on app lock';
const CONFIRM_OFF_MESSAGE = 'Confirm to turn off app lock';

interface LockToggleRowProps {
  /** Renders a top divider — use when appended after an existing security row inside the same card (matches that row's own bottom-border convention). */
  withTopBorder?: boolean;
}

/**
 * Batch 5 Slice 3 refinement (ADR-051 "SLICE 3 REFINEMENT", 2026-07-30):
 * per-user/per-device app-root-lock toggle for each role's account screen.
 *
 * Wireframe fidelity: `Wireframe-Sales-BizLink.html` (~line 1002) has an
 * exact match — "Fingerprint unlock … Enabled · works for offline app
 * unlock … On" badge row. `Wireframe-Manager-BizLink.html` and
 * `Wireframe-Executive-BizLink.html` have NO equivalent row (only "Change
 * passcode"/"Client info protection") — per this repo's no-invented-UI
 * rule, this component is still used there (closest matching security-row
 * pattern, same card/list convention as the existing rows) rather than
 * inventing new copy from scratch. TODO(Q4, Slice 4): confirm exact
 * Manager/Executive wireframe copy for this row once the wireframe
 * corrections land (see Decisions.md ADR-051 "Still-open items").
 */
export function LockToggleRow({ withTopBorder = false }: LockToggleRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const { refreshLockConfig } = useAppLock();
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // Deliberately NOT sourced from useAppLock()'s `capability` — that's only
  // recomputed on session-status transitions or after a toggle flip, and
  // `lib/device-unlock.ts`'s own doc comment requires a fresh probe on every
  // call (biometric enrollment can change while the app is backgrounded).
  const [capability, setCapability] = useState<UnlockCapability>('none');

  useEffect(() => {
    let cancelled = false;
    void getLockPreference().then((value) => {
      if (cancelled) return;
      setEnabled(value);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getUnlockCapability().then((value) => {
        if (!cancelled) setCapability(value);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleToggle = useCallback(
    async (next: boolean): Promise<void> => {
      if (busy) return;
      setBusy(true);
      try {
        // Both turning ON and turning OFF require a successful device-credential
        // confirmation (ADR-051 Slice 3 refinement) — a temporarily-unlocked
        // phone must not be able to silently disable protection.
        const confirmed = await requestDeviceUnlock(next ? CONFIRM_ON_MESSAGE : CONFIRM_OFF_MESSAGE);
        if (!confirmed) return; // Failure/cancellation — leave the toggle at its current value.
        await setLockPreference(next);
        setEnabled(next);
        await refreshLockConfig();
      } finally {
        setBusy(false);
      }
    },
    [busy, refreshLockConfig]
  );

  const noCredential = capability === 'none';
  const disabled = !loaded || busy || noCredential;
  // If a device loses its enrolled credential after the user previously
  // enabled the lock (stored preference stays true), the switch must not
  // visually claim ON when it can't actually function — ADR-051 "SLICE 3
  // REFINEMENT": "OFF is the locked state when capability is 'none'". The
  // stored preference itself is left untouched so it resumes once a
  // credential is re-enrolled.
  const displayEnabled = noCredential ? false : enabled;

  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      padding={16}
      minHeight={44}
      borderTopWidth={withTopBorder ? 1 : 0}
      borderTopColor={BIZLINK_COLORS.line}
    >
      <Fingerprint size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
      <YStack flex={1}>
        <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
          Fingerprint unlock
        </Text>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          {noCredential ? NO_CREDENTIAL_ADVISORY : 'Enabled · works for offline app unlock'}
        </Text>
      </YStack>
      <Switch
        value={displayEnabled}
        onValueChange={(next) => void handleToggle(next)}
        disabled={disabled}
        trackColor={{ true: BIZLINK_COLORS.brand, false: BIZLINK_COLORS.line }}
      />
    </XStack>
  );
}
