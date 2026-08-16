import { Alert } from 'react-native';
import { Key, Lock } from 'lucide-react-native';
import { COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { initialsFromName } from '../../lib/display-name';
import { Avatar } from '../../components/ui/Avatar';
import { AccountScreen } from '../../components/account/AccountScreen';
import { useSignOutWithSyncWarning } from '../../lib/use-sign-out-with-sync-warning';
import { SignOutSyncWarningDialog } from '../../components/bizlink/SignOutSyncWarningDialog';

/**
 * F-007 first draft (2026-07-25): Collector Account & Security — wireframe
 * `c-account`. Reuses the shared AccountScreen shell like the Manager/
 * Executive roles. Passcode change is UI-only for now.
 */
export default function CollectionAccountScreen() {
  const { fullName, profileId, role, signOut, teamId } = useSession();
  const name = fullName ?? 'Collection Officer';
  const { requestSignOut, dialogProps } = useSignOutWithSyncWarning();

  return (
    <>
      <AccountScreen
        avatar={<Avatar initials={initialsFromName(fullName)} size="lg" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />}
        name={name}
        subtitle="Collection Officer · Bataan route"
        securityItems={[
          {
            key: 'passcode',
            icon: <Key size={18} color={COLORS.eel} strokeWidth={1.75} />,
            label: 'Change passcode',
            onPress: () => Alert.alert('Passcode', 'Passcode updated (demo)'),
          },
          {
            key: 'protection',
            icon: <Lock size={18} color={COLORS.eel} strokeWidth={1.75} />,
            label: 'Customer info protection',
            sublabel: 'Fingerprint / passcode required to view',
          },
        ]}
        sessionPolicyText="You stay logged in all day, even offline. Automatic logout every 12:00 midnight. If the phone is lost, an admin deactivates the account."
        onSignOut={() => void requestSignOut({
          profileId,
          teamId,
          role,
          completeSignOut: async () => signOut(),
        })}
      />
      <SignOutSyncWarningDialog {...dialogProps} />
    </>
  );
}
