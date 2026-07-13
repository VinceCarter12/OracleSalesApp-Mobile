import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
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
    <YStack flex={1} backgroundColor={COLORS.snow} alignItems="center" justifyContent="center" paddingHorizontal="$7" gap="$4">
      <Pressable onPress={unlock}>
        <View
          width={104}
          height={104}
          borderRadius={52}
          backgroundColor={COLORS.blueSoft}
          alignItems="center"
          justifyContent="center"
        >
          <Fingerprint size={46} color={COLORS.blue} />
        </View>
      </Pressable>

      <YStack alignItems="center" gap="$1.5">
        <Text fontWeight="800" fontSize={19} color={COLORS.eel}>Protektadong impormasyon</Text>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center" lineHeight={19}>
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
            borderColor={COLORS.swan}
            backgroundColor={i < passcode.length ? COLORS.feather : 'transparent'}
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
              borderRadius: 14,
              backgroundColor: key ? COLORS.polar : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text fontWeight="800" fontSize={18} color={COLORS.eel}>{key}</Text>
          </Pressable>
        ))}
      </XStack>

      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
        <Text fontSize={12.5} fontWeight="800" color={COLORS.blue}>Cancel</Text>
      </Pressable>
    </YStack>
  );
}
