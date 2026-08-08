import { Stack } from 'expo-router';

// No "index" screen: the More hub page was removed (2026-08-03) once every
// tile it contained became directly reachable from Home's own "Iba pang
// gawain" grid (Wireframe-Sales-BizLink.html `a-home`), matching the
// wireframe's own routing — Home links straight into each sub-screen below,
// nothing routes through a bare `/(tabs)/more` anymore. expo-router doesn't
// require a group to declare an index route; a stale deep link to the bare
// path falls through to the app's default not-found screen instead of
// crashing.
export default function MoreStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="notifications" />
      <Stack.Screen name="tag-along" />
      <Stack.Screen name="sync-history" />
      <Stack.Screen name="sync-record/[id]" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="clock-in-out" />
      <Stack.Screen name="maps" />
      <Stack.Screen name="office-map/[id]" />
      <Stack.Screen name="my-requests/index" />
      <Stack.Screen name="my-requests/[id]" />
      <Stack.Screen name="lost-opportunities/index" />
      <Stack.Screen name="lost-opportunities/[id]" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
