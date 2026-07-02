import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Input, Label, Spinner, Text, YStack } from 'tamagui';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login Failed', error.message);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <YStack flex={1} justifyContent="center" padding="$6" gap="$4" backgroundColor="$background">
        <Text fontSize="$8" fontWeight="700" textAlign="center" color="$color">
          Oracle Sales
        </Text>
        <Text fontSize="$4" textAlign="center" color="$colorPress">
          Field Agent App
        </Text>

        <YStack gap="$2" marginTop="$4">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            placeholder="agent@oraclecorp.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            size="$4"
          />
        </YStack>

        <YStack gap="$2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            size="$4"
          />
        </YStack>

        <Button
          size="$4"
          marginTop="$4"
          onPress={handleLogin}
          disabled={loading}
          theme="active"
          icon={loading ? <Spinner /> : undefined}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </YStack>
    </KeyboardAvoidingView>
  );
}
