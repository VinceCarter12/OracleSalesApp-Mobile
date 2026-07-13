import { TamaguiProvider } from 'tamagui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

  if (!isSignedIn) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
      </Stack>
    );
  }

  // Sales Manager and RSR Manager share the same (manager) UI — the data layer
  // scopes it to the right team (ADR-014; rsr_manager is mobile-based as of
  // 2026-07-11). Executive gets its own view-only group; agents (Sales + RSR)
  // share (tabs), differing only by the F-012 quota widget (ADR-013).
  const group =
    role === 'sales_manager' || role === 'rsr_manager'
      ? '(manager)'
      : role === 'executive'
        ? '(executive)'
        : '(tabs)';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name={group} />
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
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StatusBar style="auto" />
      <SessionProvider>
        <GateProvider>
          <RootNavigator />
        </GateProvider>
      </SessionProvider>
    </TamaguiProvider>
  );
}
