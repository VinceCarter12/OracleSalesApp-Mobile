import { Stack } from 'expo-router';
import { useGate } from '../../../lib/gate-context';
import { SecurityGate } from '../../../components/security/SecurityGate';

/** Clients carries sensitive client info — gated per ADR-007. */
export default function ClientsStackLayout() {
  const { unlocked } = useGate();

  if (!unlocked) return <SecurityGate />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="complete" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
