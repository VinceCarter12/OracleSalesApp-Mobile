import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { useSession } from '../../lib/session-store';
import { setManagerTrack } from '../../lib/manager-data';
import { withTimeout } from '../../lib/with-timeout';
import { Field } from '../../components/ui/Field';
import { DuoButton } from '../../components/ui/DuoButton';
import type { UserRole } from '../../types';

const MANAGER_ROLES: UserRole[] = ['sales_manager', 'rsr_manager'];

/** Maps raw Supabase/network errors to the wireframe's login-error copy (a-loginErr). */
function toFriendlyMessage(error: Error): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'Invalid email or password. Try again.';
  }
  if (msg.includes('email not confirmed')) {
    return 'This account is not yet confirmed. Contact your admin.';
  }
  if (msg.includes('timed out')) {
    return 'Connection timed out. Check your internet and try again.';
  }
  return error.message;
}

export default function LoginScreen() {
  const { signInWithPassword } = useAuth();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn(): Promise<void> {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { error: authError, userId } = await signInWithPassword(email.trim(), password);
      if (authError || !userId) {
        setErrorMessage(toFriendlyMessage(authError ?? new Error('Invalid credentials.')));
        return;
      }

      const { data: profile, error: profileError } = await withTimeout(
        Promise.resolve(
          supabase.from('profiles').select('role, is_active').eq('user_id', userId).maybeSingle()
        ),
        10000,
        'profiles lookup'
      );

      if (profileError || !profile) {
        setErrorMessage('No profile found for this account. Contact your admin.');
        await supabase.auth.signOut();
        return;
      }
      if (!profile.is_active) {
        setErrorMessage('This account has been deactivated. Contact your admin.');
        await supabase.auth.signOut();
        return;
      }

      const role = profile.role as UserRole;
      if (MANAGER_ROLES.includes(role)) {
        setManagerTrack(role);
      }
      signIn(role);
      // No manual navigation — RootNavigator's Stack.Protected guards
      // (app/_layout.tsx) switch to the matching route group as soon as
      // isSignedIn/role update above.
    } catch (err) {
      setErrorMessage(toFriendlyMessage(err as Error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <YStack backgroundColor={COLORS.snow}>
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
              Sign in to continue
            </Text>
          </YStack>

          {errorMessage ? (
            <XStack
              gap="$2"
              alignItems="center"
              backgroundColor={COLORS.redSoft}
              borderRadius={12}
              paddingHorizontal={14}
              paddingVertical={10}
              marginBottom="$3.5"
            >
              <AlertTriangle size={16} color={COLORS.ledgeRed} />
              <Text fontSize={13} fontWeight="700" color={COLORS.ledgeRed} flex={1}>
                {errorMessage}
              </Text>
            </XStack>
          ) : null}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            showToggle
          />

          <DuoButton
            label={submitting ? 'Signing in…' : 'Sign In'}
            onPress={handleSignIn}
            disabled={submitting || !email.trim() || !password}
            style={{ marginTop: 8 }}
          />
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
