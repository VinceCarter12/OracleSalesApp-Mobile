import { Stack } from 'expo-router';

export default function TeamStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[agentId]" />
    </Stack>
  );
}
