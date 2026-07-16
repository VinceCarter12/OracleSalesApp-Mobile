import { TamaguiProvider } from 'tamagui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
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
import { DATABASE_NAME, migrateDbIfNeeded } from '../lib/db';
import { useSync } from '../lib/use-sync';

function RootNavigator() {
  const { isSignedIn, role, profileId } = useSession();
  // T-002: fires an outbox push + sync-down whenever connectivity comes back,
  // for as long as a signed-in session exists. Uses `profiles.id`, not the
  // Supabase Auth uid — every clients/meetings ownership FK points at
  // `profiles.id` (see lib/session-store.tsx).
  useSync(isSignedIn ? profileId : null);
  // ADR-017 (2026-07-14): one sales_manager role covers both tracks — which
  // team (Sales vs RSR) they manage is set via team_id, not a separate role.
  const isManager = role === 'sales_manager';
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
      {/* T-001: local SQLite is the primary write path (ADR-001/002/004) —
          onInit runs the versioned migration once per launch, before any
          screen underneath can read/write the local DB. */}
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <StatusBar style="auto" />
          <SessionProvider>
            <GateProvider>
              <RootNavigator />
            </GateProvider>
          </SessionProvider>
        </TamaguiProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
