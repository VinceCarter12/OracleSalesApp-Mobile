import { Stack } from 'expo-router';

export default function ManagerMoreStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="clients/index" />
      <Stack.Screen name="clients/[id]" />
      <Stack.Screen name="clients/reassign" />
      <Stack.Screen name="meetings/index" />
      <Stack.Screen name="meetings/[id]" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="maps" />
      <Stack.Screen name="account" />
    </Stack>
  );
}