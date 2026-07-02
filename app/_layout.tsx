import { TamaguiProvider } from 'tamagui';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import tamaguiConfig from '../tamagui.config';
import { useAuth } from '../lib/useAuth';

export default function RootLayout() {
  const { session, loading } = useAuth();

  if (loading) return null;

  return (
    <TamaguiProvider config={tamaguiConfig}>
      <StatusBar style="auto" />
      {!session ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
        </Stack>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      )}
    </TamaguiProvider>
  );
}
