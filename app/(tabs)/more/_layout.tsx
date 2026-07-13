import { Stack } from 'expo-router';

export default function MoreStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="tag-along" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="maps" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
