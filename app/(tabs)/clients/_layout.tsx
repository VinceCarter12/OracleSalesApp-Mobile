import { Stack } from 'expo-router';

/** Clients carries sensitive client info. Per-page passcode gate removed per ADR-050 — see Batch-5-Security-Session-Replan-2026-07-30.md. */
export default function ClientsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="complete" />
      <Stack.Screen name="office-location" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
