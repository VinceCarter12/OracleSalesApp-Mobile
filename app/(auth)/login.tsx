import { Pressable, ScrollView } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { ChevronRight } from 'lucide-react-native';
import { COLORS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { setManagerTrack } from '../../lib/manager-data';
import type { UserRole } from '../../types';

/**
 * FRONTEND-ONLY WALKTHROUGH MODE (decided 2026-07-11, see Sprint.md) — real
 * Supabase auth (lib/useAuth.ts's signInWithPassword, still intact) is
 * intentionally bypassed here. Tapping a role signs in locally via
 * useSession().signIn(role) — no credential check. Swap this screen back to
 * the email/password + signInWithPassword flow once the team says frontend
 * review is done and backend wiring (T-002/T-003) should resume.
 */
const ROLE_OPTIONS: { role: UserRole; label: string; helper: string }[] = [
  { role: 'sales_specialist', label: 'Sales Agent', helper: 'Own clients + meetings, full Record Meeting flow' },
  { role: 'rsr', label: 'RSR', helper: 'Same as Sales Agent + daily visit quota (F-012)' },
  { role: 'sales_manager', label: 'Sales Manager', helper: 'Team dashboard, approvals, Sales track' },
  { role: 'rsr_manager', label: 'RSR Manager', helper: 'Team dashboard, approvals, RSR track' },
  { role: 'executive', label: 'Executive', helper: 'Company-wide view-only dashboard' },
];

export default function LoginScreen() {
  const { signIn } = useSession();

  function pickRole(role: UserRole) {
    if (role === 'sales_manager' || role === 'rsr_manager') {
      setManagerTrack(role);
    }
    signIn(role);
    // No manual navigation — RootNavigator (app/_layout.tsx) swaps to the
    // matching route group as soon as isSignedIn/role update above.
  }

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} justifyContent="center" paddingHorizontal="$5">
      <YStack alignItems="center" marginBottom="$6">
        <View
          width={72}
          height={72}
          borderRadius={36}
          backgroundColor={COLORS.greenTint}
          alignItems="center"
          justifyContent="center"
          marginBottom="$3"
        >
          <Text fontSize={28} fontWeight="800" color={COLORS.ledgeGreen}>
            O
          </Text>
        </View>
        <Text fontSize={26} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>
          Oracle Sales
        </Text>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop="$1" textAlign="center">
          Walkthrough mode — piliin ang role para tingnan
        </Text>
      </YStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$2.5">
          {ROLE_OPTIONS.map((option) => (
            <Pressable key={option.role} onPress={() => pickRole(option.role)}>
              <XStack
                alignItems="center"
                gap="$3"
                borderWidth={2}
                borderColor={COLORS.swan}
                borderRadius={14}
                padding="$3.5"
                backgroundColor={COLORS.snow}
              >
                <YStack flex={1}>
                  <Text fontWeight="800" fontSize={14.5} color={COLORS.eel}>{option.label}</Text>
                  <Text fontSize={11.5} fontWeight="600" color={COLORS.hare} marginTop={2}>{option.helper}</Text>
                </YStack>
                <ChevronRight size={18} color={COLORS.swanLedge} />
              </XStack>
            </Pressable>
          ))}
        </YStack>
      </ScrollView>

      <Text fontSize={11.5} fontWeight="600" color={COLORS.hare} textAlign="center" marginTop="$5" lineHeight={16}>
        Frontend-only walkthrough — walang credential na kailangan.{'\n'}Babalik ito sa totoong sign-in pagkatapos ma-confirm ang frontend.
      </Text>
    </YStack>
  );
}
