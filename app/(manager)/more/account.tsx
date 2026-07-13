import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Key, Lock } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { managerProfile } from '../../../lib/manager-data';
import { useManagerDashboard } from '../../../lib/useManagerDashboard';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { DuoButton } from '../../../components/ui/DuoButton';
import { showToast } from '../../../lib/toast';

/** Wireframe s-account (was Profile) — ungated: this-month stats, security row, sign out. */
export default function ManagerAccountScreen() {
  const { summary } = useManagerDashboard();
  const { signOut } = useSession();
  const { signOut: signOutSupabase } = useAuth();

  async function handleSignOut(): Promise<void> {
    await signOutSupabase();
    signOut();
    router.replace('/(auth)/login');
  }

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Account & Security" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3.5">
          <XStack width={60} height={60} borderRadius={30} alignItems="center" justifyContent="center" backgroundColor={COLORS.greenTint}>
            <Text fontWeight="800" fontSize={22} color={COLORS.ledgeGreen}>
              {managerProfile().fullName.split(' ').map((part) => part[0]).join('')}
            </Text>
          </XStack>
          <YStack>
            <Text fontWeight="800" fontSize={17} color={COLORS.eel}>{managerProfile().fullName}</Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>
              {managerProfile().title} · {managerProfile().team}
            </Text>
          </YStack>
        </Card>

        <SectionHeader title="This month" />
        <XStack gap="$2.5">
          <StatBox value={summary?.teamMeetings ?? 0} label="Team meetings" color={COLORS.ledgeGreen} />
          <StatBox value={summary?.teamProspects ?? 0} label="Prospects" color={COLORS.blue} />
          <StatBox value={7} label="New clients" color={COLORS.orange} />
        </XStack>

        <SectionHeader title="Security" />
        <Card>
          <XStack alignItems="center" gap="$2.5" paddingVertical={9} onPress={() => showToast('Passcode updated (demo)')}>
            <Key size={15} color={COLORS.eel} />
            <Text fontSize={13.5} fontWeight="700" color={COLORS.eel} flex={1}>Change passcode</Text>
            <Text fontSize={16} color={COLORS.swanLedge}>›</Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5" paddingVertical={9} borderTopWidth={2} borderTopColor={COLORS.polar}>
            <Lock size={15} color={COLORS.eel} />
            <YStack flex={1}>
              <Text fontSize={13.5} fontWeight="700" color={COLORS.eel}>Client info protection</Text>
              <Text fontSize={11} fontWeight="600" color={COLORS.hare}>Fingerprint / passcode required to view</Text>
            </YStack>
          </XStack>
        </Card>

        <YStack backgroundColor={COLORS.polar} borderRadius={16} padding="$3.5" marginTop="$4" gap="$1">
          <XStack alignItems="center" gap="$1.5">
            <Lock size={13} color={COLORS.eel} />
            <Text fontSize={12.5} fontWeight="800" color={COLORS.eel}>Session policy</Text>
          </XStack>
          <Text fontSize={12} fontWeight="600" color={COLORS.hare} lineHeight={17}>
            Naka-login ka buong araw kahit offline. Auto-logout tuwing 12:00 midnight. Kapag nawala ang phone, admin
            ang magde-deactivate ng account.
          </Text>
        </YStack>

        <YStack marginTop="$5">
          <DuoButton label="Sign Out" variant="red" onPress={handleSignOut} />
        </YStack>
      </ScrollView>
    </YStack>
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
