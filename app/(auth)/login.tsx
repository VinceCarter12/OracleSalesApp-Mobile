import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import { useSession } from '../../lib/session-store';
import { setManagerTrack } from '../../lib/manager-data';
import { withTimeout } from '../../lib/with-timeout';
import type { UserRole } from '../../types';

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
  const insets = useSafeAreaInsets();
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
          supabase.from('profiles').select('id, role, is_active, team_id').eq('user_id', userId).maybeSingle()
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
      // Track (Sales vs RSR) is keyed off team_id, not role — ADR-017: there
      // is only one sales_manager role, no separate rsr_manager.
      if (role === 'sales_manager') {
        setManagerTrack(profile.team_id);
      }
      signIn(role, profile.team_id, profile.id);
      // No manual navigation — RootNavigator's Stack.Protected guards
      // (app/_layout.tsx) switch to the matching route group as soon as
      // isSignedIn/role update above.
    } catch (err) {
      setErrorMessage(toFriendlyMessage(err as Error));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && Boolean(email.trim()) && Boolean(password);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BIZLINK_COLORS.ink, paddingTop: insets.top, paddingBottom: insets.bottom }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ backgroundColor: BIZLINK_COLORS.ink }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <YStack backgroundColor={BIZLINK_COLORS.ink}>
          <YStack alignItems="center" marginBottom="$5">
            <View
              width={96}
              height={96}
              borderRadius={48}
              backgroundColor={BIZLINK_ON_INK.circleFill}
              borderWidth={2}
              borderColor={BIZLINK_ON_INK.circleBorder}
              alignItems="center"
              justifyContent="center"
              marginBottom="$3.5"
            >
              <Text fontSize={34} fontFamily={BIZLINK_FONTS.bold} color={BIZLINK_COLORS.card} letterSpacing={-1}>
                OS
              </Text>
            </View>
            <Text fontSize={26} fontFamily={BIZLINK_FONTS.semibold} letterSpacing={-0.6} color={BIZLINK_COLORS.card}>
              Oracle Sales
            </Text>
            <Text
              fontSize={13}
              fontFamily={BIZLINK_FONTS.regular}
              color={BIZLINK_ON_INK.textMuted}
              marginTop="$1"
              textAlign="center"
            >
              Field Agent App — i-track ang clients, meetings at prospects sa isang app
            </Text>
          </YStack>

          {errorMessage ? (
            <XStack
              gap="$2"
              alignItems="center"
              backgroundColor={BIZLINK_COLORS.tintB}
              borderRadius={16}
              paddingHorizontal={14}
              paddingVertical={12}
              marginBottom="$3.5"
            >
              <AlertTriangle size={16} color={BIZLINK_COLORS.red} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} flex={1}>
                {errorMessage}
              </Text>
            </XStack>
          ) : null}

          <LoginField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="agent@oraclecorp.com"
            keyboardType="email-address"
          />
          <LoginField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          <Pressable
            onPress={handleSignIn}
            disabled={!canSubmit}
            style={{
              marginTop: 8,
              height: 52,
              borderRadius: 999,
              backgroundColor: BIZLINK_COLORS.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>

          <Text
            fontSize={12}
            fontFamily={BIZLINK_FONTS.regular}
            color={BIZLINK_ON_INK.textMutedFooter}
            textAlign="center"
            marginTop="$4"
          >
            Sessions last the whole workday — auto-logout at 12:00 midnight only
          </Text>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface LoginFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
}

/** BizLink-styled dark-onboarding input — translucent-white fill, matches Wireframe-Sales-BizLink.html's #a-login .inp. */
function LoginField({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }: LoginFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isSecure = secureTextEntry && !revealed;

  return (
    <YStack marginBottom="$3.5" gap="$1.5">
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMutedFooter}>
        {label}
      </Text>
      <View position="relative">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={BIZLINK_ON_INK.placeholder}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize="none"
          style={{
            height: 52,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingRight: secureTextEntry ? 48 : 16,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.card,
            backgroundColor: BIZLINK_ON_INK.inputFill,
          }}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((prev) => !prev)}
            style={{ position: 'absolute', right: 14, top: 0, height: 52, width: 44, justifyContent: 'center', alignItems: 'flex-end' }}
            hitSlop={8}
          >
            {revealed ? (
              <EyeOff size={18} color={BIZLINK_ON_INK.textMuted} strokeWidth={1.75} />
            ) : (
              <Eye size={18} color={BIZLINK_ON_INK.textMuted} strokeWidth={1.75} />
            )}
          </Pressable>
        ) : null}
      </View>
    </YStack>
  );
}
