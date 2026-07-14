import { TamaguiProvider } from 'tamagui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import tamaguiConfig from '../tamagui.config';
import { SessionProvider, useSession } from '../lib/session-store';
import { GateProvider } from '../lib/gate-context';

function RootNavigator() {
  const { isSignedIn, role } = useSession();
  const isManager = role === 'sales_manager' || role === 'rsr_manager';
  const isExecutive = role === 'executive';

  // Stack.Protected declares every group up front and toggles access via
  // `guard` — expo-router handles the redirect itself when a guard flips.
  // The previous pattern (conditionally rendering a single <Stack.Screen>)
  // updated this component's state correctly but did not reliably force
  // React Navigation to switch the visible screen (confirmed via on-device
  // logging, 2026-07-14) — Stack.Protected is the supported fix for that.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && isManager}>
        <Stack.Screen name="(manager)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && isExecutive}>
        <Stack.Screen name="(executive)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && !isManager && !isExecutive}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Inter is the official app typeface (ADR-011).
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <StatusBar style="auto" />
        <SessionProvider>
          <GateProvider>
            <RootNavigator />
          </GateProvider>
        </SessionProvider>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
