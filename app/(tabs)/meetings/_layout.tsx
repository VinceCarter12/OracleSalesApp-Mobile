import { Stack } from 'expo-router';

/** Meetings carries sensitive client info. Per-page passcode gate removed per ADR-050 — see Batch-5-Security-Session-Replan-2026-07-30.md. */
export default function MeetingsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="select-client" />
      <Stack.Screen name="record" />
      <Stack.Screen name="record-visit" />
      <Stack.Screen name="celebrate" options={{ gestureEnabled: false }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
