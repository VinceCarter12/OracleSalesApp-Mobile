import { router } from 'expo-router';
import { Key } from 'lucide-react-native';
import { COLORS } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { showToast } from '../../../lib/toast';
import { Avatar } from '../../../components/ui/Avatar';
import { AccountScreen } from '../../../components/account/AccountScreen';

/** Wireframe x-account — Executive profile, security row, sign out. */
export default function ExecutiveAccountScreen() {
  const { signOut } = useSession();
  const { signOut: signOutSupabase } = useAuth();

  async function handleSignOut(): Promise<void> {
    await signOutSupabase();
    signOut();
    router.replace('/(auth)/login');
  }

  return (
    <AccountScreen
      avatar={<Avatar initials="EX" size="lg" background={COLORS.purpleSoft} color={COLORS.purple} />}
      name="Executive"
      subtitle="Company-wide na access"
      onSignOut={handleSignOut}
      securityItems={[
        {
          key: 'passcode',
          icon: <Key size={15} color={COLORS.eel} />,
          label: 'Change passcode',
          onPress: () => showToast('Passcode updated (demo)'),
        },
      ]}
    />
  );
}
