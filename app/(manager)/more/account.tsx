import { router } from 'expo-router';
import { Key, Lock } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { managerProfile } from '../../../lib/manager-data';
import { useManagerDashboard } from '../../../lib/useManagerDashboard';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { showToast } from '../../../lib/toast';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { Avatar } from '../../../components/ui/Avatar';
import { AccountScreen } from '../../../components/account/AccountScreen';

/** Wireframe s-account (was Profile) — ungated: this-month stats, security row, sign out. */
export default function ManagerAccountScreen() {
  const { summary } = useManagerDashboard();
  const { signOut } = useSession();
  const { signOut: signOutSupabase } = useAuth();
  const profile = managerProfile();

  async function handleSignOut(): Promise<void> {
    await signOutSupabase();
    signOut();
    router.replace('/(auth)/login');
  }

  return (
    <AccountScreen
      avatar={<Avatar initials={profile.fullName.split(' ').map((part) => part[0]).join('')} size="lg" />}
      name={profile.fullName}
      subtitle={`${profile.title} · ${profile.team}`}
      onSignOut={handleSignOut}
      statsSlot={
        <>
          <SectionHeader title="This month" />
          <XStack gap="$2.5">
            <StatBox value={summary?.teamMeetings ?? 0} label="Team meetings" color={COLORS.ledgeGreen} />
            <StatBox value={summary?.teamProspects ?? 0} label="Prospects" color={COLORS.blue} />
            <StatBox value={7} label="New clients" color={COLORS.orange} />
          </XStack>
        </>
      }
      securityItems={[
        {
          key: 'passcode',
          icon: <Key size={15} color={COLORS.eel} />,
          label: 'Change passcode',
          onPress: () => showToast('Passcode updated (demo)'),
        },
        {
          key: 'client-info-protection',
          icon: <Lock size={15} color={COLORS.eel} />,
          label: 'Client info protection',
          sublabel: 'Fingerprint / passcode required to view',
        },
      ]}
      sessionPolicyText="Naka-login ka buong araw kahit offline. Auto-logout tuwing 12:00 midnight. Kapag nawala ang phone, admin ang magde-deactivate ng account."
    />
  );
}

function StatBox({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow} borderWidth={2} borderColor={COLORS.swan} borderRadius={16} padding="$3">
      <Text fontSize={20} fontWeight="800" color={color}>{value}</Text>
      <Text fontSize={11.5} fontWeight="700" color={COLORS.hare}>{label}</Text>
    </YStack>
  );
}
