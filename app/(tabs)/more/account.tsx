import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Key, Lock } from 'lucide-react-native';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { COLORS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { Avatar } from '../../../components/ui/Avatar';
import { AccountScreen } from '../../../components/account/AccountScreen';

/** Wireframe a-account — profile, security actions, session policy, sign out. */
export default function AgentAccountScreen() {
  const { signOut } = useSession();
  const { signOut: signOutSupabase } = useAuth();

  function confirmSignOut(): void {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOutSupabase();
          signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <AccountScreen
      avatar={<Avatar initials="MS" size="lg" />}
      name="Miguel Santos"
      subtitle="Sales Specialist"
      onSignOut={confirmSignOut}
      securityItems={[
        {
          key: 'passcode',
          icon: <Key size={16} color={COLORS.eel} />,
          label: 'Change passcode',
          onPress: () => showToast('✓ Passcode updated (demo)'),
        },
        {
          key: 'client-info-protection',
          icon: <Lock size={16} color={COLORS.eel} />,
          label: 'Client info protection',
          sublabel: 'Fingerprint / passcode required to view',
        },
      ]}
      sessionPolicyText="Naka-login ka buong araw kahit offline. Auto-logout tuwing 12:00 midnight."
    />
  );
}
