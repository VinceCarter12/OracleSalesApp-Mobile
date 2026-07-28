import { COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { initialsFromName } from '../../lib/display-name';
import { Avatar } from '../../components/ui/Avatar';
import { AccountScreen } from '../../components/account/AccountScreen';

/**
 * F-007 first draft (2026-07-25): Delivery Account & Security — wireframe
 * `d-account`. Reuses the shared AccountScreen shell. The whole delivery
 * module is still DRAFT pending spec (OQ-5).
 */
export default function DeliveryAccountScreen() {
  const { fullName, signOut } = useSession();
  const name = fullName ?? 'Delivery';

  return (
    <AccountScreen
      avatar={<Avatar initials={initialsFromName(fullName)} size="lg" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />}
      name={name}
      subtitle="Delivery · Bataan"
      securityItems={[]}
      sessionPolicyText="Naka-login ka buong araw kahit offline. Auto-logout tuwing 12:00 midnight."
      onSignOut={signOut}
    />
  );
}
