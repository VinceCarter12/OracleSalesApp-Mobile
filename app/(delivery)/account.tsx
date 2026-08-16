import { COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { initialsFromName } from '../../lib/display-name';
import { Avatar } from '../../components/ui/Avatar';
import { AccountScreen } from '../../components/account/AccountScreen';
import { useSignOutWithSyncWarning } from '../../lib/use-sign-out-with-sync-warning';
import { SignOutSyncWarningDialog } from '../../components/bizlink/SignOutSyncWarningDialog';

/**
 * F-007 first draft (2026-07-25): Delivery Account & Security — wireframe
 * `d-account`. Reuses the shared AccountScreen shell. The whole delivery
 * module is still DRAFT pending spec (OQ-5).
 */
export default function DeliveryAccountScreen() {
  const { fullName, profileId, role, signOut, teamId } = useSession();
  const name = fullName ?? 'Delivery';
  const { requestSignOut, dialogProps } = useSignOutWithSyncWarning();

  return (
    <>
      <AccountScreen
        avatar={<Avatar initials={initialsFromName(fullName)} size="lg" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />}
        name={name}
        subtitle="Delivery · Bataan"
        securityItems={[]}
        sessionPolicyText="You stay logged in all day, even offline. Automatic logout every 12:00 midnight."
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
