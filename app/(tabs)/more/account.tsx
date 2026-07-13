import { Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Key, Lock } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { useSession } from '../../../lib/session-store';
import { useAuth } from '../../../lib/useAuth';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { Avatar } from '../../../components/ui/Avatar';
import { DuoButton } from '../../../components/ui/DuoButton';

/** Wireframe a-account — profile, security actions, session policy, sign out. */
export default function AccountScreen() {
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
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Account & Security" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3.5">
          <Avatar initials="MS" size="lg" />
          <YStack>
            <Text fontWeight="800" fontSize={17} color={COLORS.eel}>Miguel Santos</Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Sales Specialist</Text>
          </YStack>
        </Card>

        <SectionHeader title="Security" />
        <Card padding={0}>
          <XStack
            alignItems="center"
            gap="$2.5"
            padding="$3.5"
            borderBottomWidth={2}
            borderBottomColor={COLORS.polar}
            onPress={() => showToast('✓ Passcode updated (demo)')}
          >
            <Key size={16} color={COLORS.eel} />
            <Text fontSize={13.5} fontWeight="700" color={COLORS.eel} flex={1}>Change passcode</Text>
            <Text color={COLORS.swanLedge}>›</Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5" padding="$3.5">
            <Lock size={16} color={COLORS.eel} />
            <YStack flex={1}>
              <Text fontSize={13.5} fontWeight="700" color={COLORS.eel}>Client info protection</Text>
              <Text fontSize={11} fontWeight="600" color={COLORS.hare}>Fingerprint / passcode required to view</Text>
            </YStack>
          </XStack>
        </Card>

        <Card flat marginTop="$4">
          <XStack alignItems="center" gap="$2">
            <Lock size={13} color={COLORS.eel} />
            <Text fontSize={12.5} fontWeight="800" color={COLORS.eel}>Session policy</Text>
          </XStack>
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop="$1" lineHeight={18}>
            Naka-login ka buong araw kahit offline. Auto-logout tuwing 12:00 midnight.
          </Text>
        </Card>

        <YStack marginTop="$5">
          <DuoButton label="Sign Out" variant="red" onPress={confirmSignOut} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
