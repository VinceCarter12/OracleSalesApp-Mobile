import { Spinner, TamaguiProvider, Theme, View } from 'tamagui';
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
import { ThemePreferenceProvider, useThemePreference } from '../lib/theme-preference';
import { AppLockProvider } from '../lib/app-lock/lock-provider';
import { DATABASE_NAME, migrateDbIfNeeded } from '../lib/db';
import { useSync } from '../lib/use-sync';
import { useColdStartBootstrap } from '../lib/app-lock/cold-start-bootstrap';
import { useSuspensionWatch } from '../lib/app-lock/use-suspension-watch';
import { AccountSuspendedScreen } from '../components/security/AccountSuspendedScreen';
import { LockGate } from '../components/security/LockGate';
import { useBizlinkColors } from '../lib/theme';

/**
 * Batch 5 Slice 1 (ADR-051): rendered only while session-store's `status` is
 * 'bootstrapping' — replaces RootNavigator's Stack entirely for that one
 * frame so no Stack.Protected guard evaluates against a not-yet-decided
 * session, which would otherwise flash the login screen before a valid
 * persisted session rehydrates.
 */
function BootstrapSplash() {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <View flex={1} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.canvas}>
      <Spinner size="large" color={BIZLINK_COLORS.brand} />
    </View>
  );
}

function RootNavigator() {
  const { status, suspended, isSignedIn, role, profileId, teamId } = useSession();
  useColdStartBootstrap();
  // Batch 5 Slice 2 (ADR-051): foreground/resume + post-rehydration checks.
  useSuspensionWatch();
  // T-002: fires an outbox push + sync-down whenever connectivity comes back,
  // for as long as a signed-in session exists. Uses `profiles.id`, not the
  // Supabase Auth uid — every clients/meetings ownership FK points at
  // `profiles.id` (see lib/session-store.tsx). `teamId` (ADR-030) powers the
  // team-roster sync-down pull for the Tag-Along companion picker.
  useSync(isSignedIn ? profileId : null, isSignedIn ? teamId : null);
  // ADR-017 (2026-07-14, retired 2026-07-23): manager gating is role-only —
  // team_id no longer implies a Sales-vs-RSR track, teams can mix roles.
  const isManager = role === 'sales_manager';
  const isExecutive = role === 'executive';
  // F-007 first draft (2026-07-25): Collection & Delivery role groups.
  const isCollector = role === 'collector';
  const isDelivery = role === 'delivery';

  // Batch 5 Slice 1: withhold every Stack.Protected guard until cold-start
  // rehydration resolves — evaluating guards against a default/unrehydrated
  // session would flash (auth) before a valid session rehydrates.
  if (status === 'bootstrapping') {
    return <BootstrapSplash />;
  }

  // Batch 5 Slice 2 (ADR-051): `suspended` is session-store's own flag,
  // intentionally not duplicated into AppLockProvider (Slice 3) — checked
  // before any Stack.Protected guard so a confirmed suspension always wins
  // over normal navigation, regardless of role/route group. `LockGate`
  // (wrapping this whole component) separately checks this same flag to
  // suppress its lock overlay here, so AccountSuspendedScreen is never
  // hidden behind it.
  if (suspended) {
    return <AccountSuspendedScreen />;
  }

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
      <Stack.Protected guard={isSignedIn && isCollector}>
        <Stack.Screen name="(collection)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && isDelivery}>
        <Stack.Screen name="(delivery)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && !isManager && !isExecutive && !isCollector && !isDelivery}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Inter is retained (ADR-011) until each screen's own ADR-024 migration
  // phase; General Sans (ADR-024, Fontshare ITF Free Font License) loads
  // alongside it — the keys below must match lib/theme.ts's BIZLINK_FONTS
  // values exactly, since expo-font uses the useFonts key as the runtime
  // font-family name for locally-bundled files.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    'GeneralSans-Regular': require('../assets/fonts/GeneralSans-Regular.otf'),
    'GeneralSans-Medium': require('../assets/fonts/GeneralSans-Medium.otf'),
    'GeneralSans-Semibold': require('../assets/fonts/GeneralSans-Semibold.otf'),
    'GeneralSans-Bold': require('../assets/fonts/GeneralSans-Bold.otf'),
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      {/* T-001: local SQLite is the primary write path (ADR-001/002/004) —
          onInit runs the versioned migration once per launch, before any
          screen underneath can read/write the local DB. */}
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <ThemePreferenceProvider>
            <ThemedApp />
          </ThemePreferenceProvider>
        </TamaguiProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

/**
 * Split from `RootLayout` so `useThemePreference()` can be called (it needs
 * `ThemePreferenceProvider` above it in the tree). `<Theme name={...}>`
 * switches every BizLink-migrated screen's colors between the
 * `tamagui.config.ts` `bizlinkLight`/`bizlinkDark` token sets — screens
 * still on the static `BIZLINK_COLORS` import are unaffected until they
 * migrate to `useBizlinkColors()`.
 */
function ThemedApp() {
  const { resolvedTheme } = useThemePreference();
  return (
    <Theme name={resolvedTheme}>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <SessionProvider>
        <AppLockProvider>
          <LockGate>
            <RootNavigator />
          </LockGate>
        </AppLockProvider>
      </SessionProvider>
    </Theme>
  );
}
