import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { useGate } from '../../lib/gate-context';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Wireframe a-gate — fingerprint icon or any 4-digit passcode unlocks for the session (demo). */
export function SecurityGate() {
  const { unlock } = useGate();
  const [passcode, setPasscode] = useState('');

  useEffect(() => {
    if (passcode.length === 4) {
      const timer = setTimeout(unlock, 180);
      return () => clearTimeout(timer);
    }
  }, [passcode, unlock]);

  function press(key: string): void {
    if (key === '⌫') {
      setPasscode((p) => p.slice(0, -1));
    } else if (key && passcode.length < 4) {
      setPasscode((p) => p + key);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.ink} alignItems="center" justifyContent="center" paddingHorizontal="$7" gap="$4">
      <Pressable onPress={unlock}>
        <View
          width={104}
          height={104}
          borderRadius={52}
          backgroundColor="rgba(255,255,255,0.12)"
          alignItems="center"
          justifyContent="center"
        >
          <Fingerprint size={46} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
        </View>
      </Pressable>

      <YStack alignItems="center" gap="$1.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={19} color={BIZLINK_COLORS.card}>Protektadong impormasyon</Text>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color="rgba(255,255,255,0.6)" textAlign="center" lineHeight={19}>
          Pindutin ang icon para gumamit ng fingerprint,{'\n'}o gamitin ang passcode sa ibaba.
        </Text>
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
