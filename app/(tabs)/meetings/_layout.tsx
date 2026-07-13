import { Stack } from 'expo-router';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';

/** Meetings carries sensitive client info — gated per ADR-007. */
export default function MeetingsStackLayout() {
  const { unlocked } = useGate();

  if (!unlocked) return <SecurityGate />;

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
