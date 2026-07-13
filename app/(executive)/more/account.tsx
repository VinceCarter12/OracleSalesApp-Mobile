import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Key } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { DuoButton } from '../../../components/ui/DuoButton';
import { showToast } from '../../../lib/toast';

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
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Account & Security" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3.5">
          <XStack width={60} height={60} borderRadius={30} alignItems="center" justifyContent="center" backgroundColor={COLORS.purpleSoft}>
            <Text fontWeight="800" fontSize={22} color={COLORS.purple}>EX</Text>
          </XStack>
          <YStack>
            <Text fontWeight="800" fontSize={17} color={COLORS.eel}>Executive</Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Company-wide na access</Text>
          </YStack>
        </Card>

        <SectionHeader title="Security" />
        <Card>
          <XStack alignItems="center" gap="$2.5" paddingVertical={9} onPress={() => showToast('Passcode updated (demo)')}>
            <Key size={15} color={COLORS.eel} />
            <Text fontSize={13.5} fontWeight="700" color={COLORS.eel} flex={1}>Change passcode</Text>
            <Text fontSize={16} color={COLORS.swanLedge}>›</Text>
          </XStack>
        </Card>

        <YStack marginTop="$5">
          <DuoButton label="Sign Out" variant="red" onPress={handleSignOut} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
