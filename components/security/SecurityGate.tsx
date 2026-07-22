import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { useGate } from '../../lib/gate-context';
import { hasPasscodeSet, verifyPasscode } from '../../lib/passcode';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/**
 * Wireframe a-gate — a real 4-digit passcode unlocks for the session
 * (B-064). Passcode-only: no fingerprint bypass (B-064 addendum — the prior
 * fingerprint icon was a direct-unlock stub with no real biometric check,
 * removed as a security fix). No wireframe screen exists for a first-run
 * "set your passcode" prompt, so per this session's no-invented-UI rule: if
 * no passcode has ever been set on this device (`hasPasscodeSet()` false),
 * the gate is pass-through (auto-unlocks) rather than blocking the agent
 * with no way in — a passcode can still be set afterward via Account &
 * Security.
 */
export function SecurityGate() {
  const { unlock } = useGate();
  const [passcode, setPasscode] = useState('');
  const [checking, setChecking] = useState(false);
  const [wrongPasscode, setWrongPasscode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasPasscodeSet().then((isSet) => {
      if (!cancelled && !isSet) unlock();
    });
    return () => {
      cancelled = true;
    };
  }, [unlock]);

  useEffect(() => {
    if (passcode.length !== 4) return;
    let cancelled = false;
    setChecking(true);
    setWrongPasscode(false);
    verifyPasscode(passcode)
      .then((valid) => {
        if (cancelled) return;
        if (valid) {
          unlock();
        } else {
          setWrongPasscode(true);
          setPasscode('');
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [passcode, unlock]);

  function press(key: string): void {
    if (checking) return;
    if (key === '⌫') {
      setPasscode((p) => p.slice(0, -1));
    } else if (key && passcode.length < 4) {
      setWrongPasscode(false);
      setPasscode((p) => p + key);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.ink} alignItems="center" justifyContent="center" paddingHorizontal="$7" gap="$4">
      <YStack alignItems="center" gap="$1.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={19} color={BIZLINK_COLORS.card}>Protektadong impormasyon</Text>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color="rgba(255,255,255,0.6)" textAlign="center" lineHeight={19}>
          Ilagay ang passcode sa ibaba.
        </Text>
        {wrongPasscode ? (
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.red}>
            Maling passcode — subukan ulit.
          </Text>
        ) : null}
      </YStack>

      <XStack gap="$3">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            width={15}
            height={15}
            borderRadius={8}
            borderWidth={2}
            borderColor="rgba(255,255,255,0.35)"
            backgroundColor={i < passcode.length ? BIZLINK_COLORS.card : 'transparent'}
          />
        ))}
      </XStack>

      <XStack flexWrap="wrap" width={250} justifyContent="space-between" gap="$2.5">
        {KEYS.map((key, i) => (
          <Pressable
            key={i}
            disabled={!key}
            onPress={() => press(key)}
            style={{
              width: 76,
              height: 52,
              borderRadius: 999,
              backgroundColor: key ? 'rgba(255,255,255,0.1)' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={18} color={BIZLINK_COLORS.card}>{key}</Text>
          </Pressable>
        ))}
      </XStack>

      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color="rgba(255,255,255,0.6)">Cancel</Text>
      </Pressable>
    </YStack>
  );
}
