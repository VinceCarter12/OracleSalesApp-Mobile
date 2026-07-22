import { Stack } from 'expo-router';

/**
 * F-205: Manager's own client/meeting flow — plain Stack, no SecurityGate
 * (mirrors `app/(manager)/team/_layout.tsx`; a manager's own clients aren't
 * behind the passcode gate the way agent-facing "More" screens are).
 */
export default function ManagerClientsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
